---
name: run-beanstalk
description: Build, run, and drive the Beanstalk web app (a life & financial planning wizard + dashboard). Use when asked to start Beanstalk, run its dev server, take a screenshot of a page (e.g. the Play/room view), or interact with the running app in a browser.
---

Beanstalk is a Vite + React SPA with no backend — auth and profile data
live entirely in browser localStorage (`src/context/AuthContext.jsx`,
`src/context/PlannerContext.jsx`). Drive it by starting the Vite dev
server, then scripting a real headless Chromium against it with
`.claude/skills/run-beanstalk/driver.mjs` (Playwright). There's no
`chromium-cli` on this machine, so the driver is a small committed
Playwright script rather than a `chromium-cli` heredoc.

All paths below are relative to the repo root.

## Prerequisites

Playwright is a devDependency (`npm install` gets it). Its browser
binary is a separate download, cached machine-wide, independent of any
one project's `node_modules`:

```bash
npx playwright install chromium
```

## Setup / Build

```bash
npm install --legacy-peer-deps
```

(`--legacy-peer-deps` is required on this branch — see Gotchas.)

No separate build step is needed to run the dev server (Vite serves
source directly).

## Run (agent path)

Start the dev server in the background and wait for it to actually
serve before driving it — don't `sleep`, poll the port:

```bash
npm run dev > /tmp/vite.log 2>&1 &
echo $! > /tmp/vite.pid
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Vite falls back to 5174, 5175, ... if 5173 is already in use — check
`/tmp/vite.log` for the actual `Local:` URL it printed and set
`BEANSTALK_URL` accordingly if it isn't 5173.

Then drive it:

```bash
node .claude/skills/run-beanstalk/driver.mjs [route]
```

- `route` defaults to `/play`.
- First run: signs up a throwaway account (`run-skill@example.com` /
  `run_skill_tester`) through the real `/signup` form, seeds a
  completed profile with a couple of room items directly into
  localStorage (skips the multi-step wizard), and saves the resulting
  browser storage state to `<os tmp>/beanstalk-run-skill-state.json`.
- Later runs reuse that saved state — no repeat signups. Delete the
  file to force a fresh signup.
- When `route` is `/play`, the driver also clicks the reduced-motion
  toggle and reads back the computed `transitionProperty` inside
  `.motion-reduce-scope` to confirm the CSS override actually applies
  (see `IMMERSIVE_GAMEPLAY.md`), not just that the button's own state
  flipped.

Screenshots land in `<os tmp>/beanstalk-shots/` (`1-initial.png`, and
`2-reduced-motion.png` for the `/play` route). Override with
`BEANSTALK_SHOT_DIR`. Env vars:

```bash
BEANSTALK_URL=http://localhost:5174 node .claude/skills/run-beanstalk/driver.mjs /play
```

Stop the server with `kill $(cat /tmp/vite.pid)` before relaunching,
or the next run hits `EADDRINUSE` on 5173 and silently shifts ports.

## Run (human path)

```bash
npm run dev   # → http://localhost:5173, Ctrl-C to stop
```

## Test

No test suite is configured in `package.json` yet — `npm run dev` /
`npm run build` are the only scripts. The driver above is the closest
thing to an automated check.

---

## Gotchas

- **Plain `npm install` fails with an ERESOLVE peer conflict** on this
  branch: `vite@^8.1.2` vs. `@vitejs/plugin-react`'s peer range
  (`^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`). Pre-existing on this
  branch, unrelated to Playwright — always use `--legacy-peer-deps`
  here until the vite bump is reconciled with `@vitejs/plugin-react`.
- **`/play` and most routes are behind `ProtectedRoute`** (see
  `src/App.jsx`) and further behind `completedWizard: true` (else
  `/` redirects to `/wizard`). The driver seeds this directly into
  `localStorage['beanstalk.profiles']` rather than clicking through
  the full wizard — match the shape in `emptyProfile`
  (`src/context/PlannerContext.jsx`) if you change what it seeds.
- **Windows / Git Bash, not Linux.** This machine is Windows 11 with
  Git Bash as the shell. `npx playwright install chromium` downloads
  a native Windows Chromium build to
  `%LOCALAPPDATA%\ms-playwright\` — no `xvfb` needed since Playwright
  launches it headless directly.
- **Port collisions.** If something (e.g. a leftover dev server from
  a previous session) already holds 5173, Vite silently moves to
  5174+ instead of erroring. Always check the printed `Local:` URL
  rather than assuming 5173.

## Troubleshooting

- **`Cannot find package 'playwright'` when running the driver
  directly with `node`**: it's not installed, or you tried running it
  via `npx -p playwright node …` (npx's temp install isn't on Node's
  ESM resolution path). Run `npm install` at the repo root first —
  the driver expects `playwright` in the repo's own `node_modules`.
- **Driver hangs on `page.waitForURL('**/wizard')`**: usually means
  the signup form validation rejected the seeded credentials (e.g. a
  `beanstalk.users` entry already exists with that email/username from
  a previous manual test). Clear the browser profile's localStorage or
  change the email/username constants in `driver.mjs`.
