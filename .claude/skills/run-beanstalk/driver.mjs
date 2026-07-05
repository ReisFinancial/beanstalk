#!/usr/bin/env node
// Drives the Beanstalk app in a real (headless) Chromium browser via
// Playwright. Beanstalk has no backend — auth and profile data are
// entirely localStorage (src/context/AuthContext.jsx,
// src/context/PlannerContext.jsx) — so "logging in" just means driving
// the real /signup form once and reusing the resulting localStorage
// state (via Playwright's storageState) on later runs, instead of
// re-signing-up (and re-cluttering beanstalk.users) every time.
//
// Usage:
//   node .claude/skills/run-beanstalk/driver.mjs [route]
//
// route defaults to /play. When route is /play, the script also
// exercises the reduced-motion toggle as a representative interaction
// and confirms the CSS override actually takes effect (not just its
// own button state) — see IMMERSIVE_GAMEPLAY.md.
//
// Env vars:
//   BEANSTALK_URL       dev server origin (default http://localhost:5173)
//   BEANSTALK_SHOT_DIR  where screenshots land (default <os tmp>/beanstalk-shots)

import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE_URL = process.env.BEANSTALK_URL || 'http://localhost:5173'
const STATE_FILE = path.join(os.tmpdir(), 'beanstalk-run-skill-state.json')
const SHOT_DIR = process.env.BEANSTALK_SHOT_DIR || path.join(os.tmpdir(), 'beanstalk-shots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const route = process.argv[2] || '/play'

const browser = await chromium.launch()
const hasState = fs.existsSync(STATE_FILE)
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ...(hasState ? { storageState: STATE_FILE } : {}),
})
const page = await context.newPage()
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))

if (!hasState) {
  console.log('No saved session — signing up a throwaway test account via the real /signup form...')
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' })
  await page.fill('#email', 'run-skill@example.com')
  await page.fill('#username', 'run_skill_tester')
  await page.fill('#password', 'testpass123')
  await page.fill('#confirm', 'testpass123')
  await page.click('button:has-text("Create account")')
  await page.waitForURL('**/wizard', { timeout: 15000 })

  // Skip the multi-step wizard by seeding a completed profile directly.
  // Shape must match emptyProfile in src/context/PlannerContext.jsx —
  // update this block if that shape changes.
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('beanstalk.session'))
    const profiles = JSON.parse(localStorage.getItem('beanstalk.profiles') || '{}')
    const now = new Date().toISOString()
    profiles[session.id] = {
      ...(profiles[session.id] || {}),
      completedWizard: true,
      room: {
        season: { current: 'spring', source: 'auto', updatedAt: now, baselineNetWorth: 0 },
        carePoints: 40,
        streak: { current: 3, longest: 5, lastVisitDate: null },
        items: [
          { id: 'itm1', kind: 'plant', speciesId: 'fern', placed: true, slotId: null, unlockedAt: now, lastTendedAt: now },
          { id: 'itm2', kind: 'decor', speciesId: 'lamp', placed: true, slotId: null, unlockedAt: now, lastTendedAt: now },
        ],
        milestones: { goalIds: [], wealthLevel: -1, petStreak: 0 },
        settings: { reducedMotion: 'system' },
      },
    }
    localStorage.setItem('beanstalk.profiles', JSON.stringify(profiles))
  })

  await context.storageState({ path: STATE_FILE })
  console.log(`Saved session to ${STATE_FILE} for reuse by future runs (delete it to force a fresh signup).`)
}

await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Play', { timeout: 15000 })
await page.screenshot({ path: path.join(SHOT_DIR, '1-initial.png') })
console.log(`Loaded ${route} -> ${SHOT_DIR}/1-initial.png`)

if (route === '/play') {
  const reducedBtn = page.getByRole('button', { name: 'Reduced' })
  await reducedBtn.click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOT_DIR, '2-reduced-motion.png') })
  const transitionValue = await page.evaluate(() => {
    const scope = document.querySelector('.motion-reduce-scope')
    if (!scope) return 'NO_SCOPE_FOUND'
    const el = scope.querySelector('button, .chip, div') || scope
    return getComputedStyle(el).transitionProperty
  })
  console.log('transitionProperty inside .motion-reduce-scope after clicking Reduced:', transitionValue)
  await page.getByRole('button', { name: 'Auto' }).click()
}

console.log('Console/page errors:', JSON.stringify(errors))
await browser.close()
