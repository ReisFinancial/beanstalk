/**
 * Pure logic for the cozy Room: care-level decay, season derivation, and
 * milestone-unlock detection. No React, no profile mutation — callers
 * (PlannerContext helpers, Room.jsx) apply the results. See
 * IMMERSIVE_GAMEPLAY.md for the design this implements.
 */
import { wealthLevel } from '../components/WealthMark.jsx'
import {
  plantSpeciesForGoalCategory,
  decorForWealthLevel,
  petForStreak,
  randomFoodFlourish,
  CARE_POINT_REWARDS,
} from '../data/roomCatalog.js'

// ── Care decay ────────────────────────────────────────────────────────────
const CARE_GRACE_DAYS = 2 // no visible decay for the first couple of days
const CARE_DECAY_DAYS = 7 // days from grace-end down to the floor
const CARE_FLOOR = 25     // never fully "dies" — one watering always fully revives it

/**
 * An item's current care level (0–100), derived from lastTendedAt rather
 * than stored, so it can't drift out of sync with the clock that drives it.
 */
export function decayCareLevel(item, now = new Date()) {
  const last = item?.lastTendedAt ? new Date(item.lastTendedAt) : null
  if (!last || Number.isNaN(last.getTime())) return 100
  const days = (now.getTime() - last.getTime()) / 86400000
  if (days <= CARE_GRACE_DAYS) return 100
  const fraction = Math.min(1, (days - CARE_GRACE_DAYS) / CARE_DECAY_DAYS)
  return Math.round(100 - fraction * (100 - CARE_FLOOR))
}

const CARE_STATES = [
  { min: 70, id: 'thriving' },
  { min: 40, id: 'okay' },
  { min: 0, id: 'wilted' },
]

// Visual bucket for a care level — drives RoomItem's sprite state.
export function careState(careLevel) {
  return (CARE_STATES.find((s) => careLevel >= s.min) || CARE_STATES[CARE_STATES.length - 1]).id
}

// ── Net worth ─────────────────────────────────────────────────────────────
// Raw current net worth from the live asset/liability ledger — not the
// projected figures the Money page's timeline slider shows.
export function currentNetWorth(profile) {
  const totalAssets = (profile?.assets || []).reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const totalLiabilities = (profile?.liabilities || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
  return totalAssets - totalLiabilities
}

// ── Season ────────────────────────────────────────────────────────────────
const SEASON_CHECK_INTERVAL_DAYS = 3 // don't reassess more often than this — avoids flapping
const SEASON_STORM_DROP_PCT = 8      // a sharp drop since the last checkpoint
const SEASON_WINTER_DROP_PCT = 3     // a milder sustained decline
const SEASON_SUMMER_GAIN_PCT = 5     // strong growth

/**
 * Derives the room's season from the user's own trailing net-worth trend
 * (v1 — no external market data yet). Reads like weather, not a verdict: a
 * storm/winter reflects a dip in the numbers, not a judgment on the user.
 * Returns the next `profile.room.season` value to persist; if it's too soon
 * to reassess, returns the input unchanged so callers can skip the write.
 */
export function computeSeason(profile, now = new Date()) {
  const prev = profile?.room?.season
    || { current: 'spring', source: 'auto', updatedAt: null, baselineNetWorth: null }
  const netWorth = currentNetWorth(profile)

  if (prev.baselineNetWorth == null || !prev.updatedAt) {
    return { ...prev, current: 'spring', source: 'auto', updatedAt: now.toISOString(), baselineNetWorth: netWorth }
  }

  const daysSinceCheck = (now.getTime() - new Date(prev.updatedAt).getTime()) / 86400000
  if (daysSinceCheck < SEASON_CHECK_INTERVAL_DAYS) return prev

  const baseline = prev.baselineNetWorth
  const pctChange = baseline !== 0
    ? ((netWorth - baseline) / Math.abs(baseline)) * 100
    : (netWorth > 0 ? 100 : 0)

  let current
  if (pctChange <= -SEASON_STORM_DROP_PCT) current = 'storm'
  else if (pctChange <= -SEASON_WINTER_DROP_PCT) current = 'winter'
  else if (pctChange < 0) current = 'autumn'
  else if (pctChange < SEASON_SUMMER_GAIN_PCT) current = 'spring'
  else current = 'summer'

  return { current, source: 'auto', updatedAt: now.toISOString(), baselineNetWorth: netWorth }
}

// ── Daily visit reward ───────────────────────────────────────────────────
/**
 * The small, financial-data-independent reward for simply showing up today
 * — always available, so the daily ritual has something pleasant even on a
 * quiet day. Call once per calendar day (PlannerContext#recordVisit already
 * guards the once-per-day streak update; gate this the same way).
 */
export function dailyVisitReward() {
  const flourish = randomFoodFlourish()
  return {
    item: { kind: 'food', speciesId: flourish.id },
    carePoints: CARE_POINT_REWARDS.dailyVisit,
  }
}

// ── Milestone unlocks ────────────────────────────────────────────────────
// Liquid subtypes that count toward a savings/investment goal's progress
// (mirrors ActionPlanner.jsx's LIQUID_ASSET_SUBTYPES).
const LIQUID_ASSET_SUBTYPES = new Set(['savings', 'investments', 'crypto'])

function liquidAssetsTotal(profile) {
  return (profile?.assets || [])
    .filter((a) => LIQUID_ASSET_SUBTYPES.has(a.subtype))
    .reduce((s, a) => s + (Number(a.amount) || 0), 0)
}

function totalLiabilities(profile) {
  return (profile?.liabilities || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

// A goal counts as "reached" once its target is met by the closest matching
// real figure. There's no per-goal link to a specific asset/liability in the
// data model yet, so this is a v1 approximation: debt goals check whether
// liabilities are fully cleared; investment/savings/other goals with a
// targetAmount check total liquid assets. Spending goals aren't completable
// — they're an ongoing lifestyle change, not a one-time target.
function isGoalReached(goal, profile) {
  if (goal.category === 'debt') return totalLiabilities(profile) <= 0
  const target = Number(goal.targetAmount)
  if (!Number.isFinite(target) || target <= 0) return false
  return liquidAssetsTotal(profile) >= target
}

/**
 * Detects milestones the profile has reached that haven't been granted yet.
 * `profile.room.milestones` tracks what's already been paid out, so this is
 * safe to call on every Room visit without double-granting. Pure — returns
 * unlock events for the caller to apply (PlannerContext's unlockRoomItem +
 * addCarePoints) plus the updated `milestones` bookkeeping to persist
 * alongside them.
 */
export function unlocksFromMilestones(profile) {
  const milestones = profile?.room?.milestones || { goalIds: [], wealthLevel: -1, petStreak: 0 }
  const events = []
  const nextMilestones = {
    goalIds: [...milestones.goalIds],
    wealthLevel: milestones.wealthLevel,
    petStreak: milestones.petStreak,
  }

  // Goals — one plant per newly-reached goal, tied to its category.
  for (const goal of profile?.goals || []) {
    if (milestones.goalIds.includes(goal.id)) continue
    if (!isGoalReached(goal, profile)) continue
    const species = plantSpeciesForGoalCategory(goal.category)
    events.push({
      type: 'goal',
      goalId: goal.id,
      item: { kind: 'plant', speciesId: species.id, sourceGoalId: goal.id },
      carePoints: CARE_POINT_REWARDS.goalCompleted,
    })
    nextMilestones.goalIds.push(goal.id)
  }

  // Wealth level — one decor piece per tier crossed (a big jump grants
  // every intermediate tier, not just the one landed on).
  const level = wealthLevel(currentNetWorth(profile))
  for (let lvl = milestones.wealthLevel + 1; lvl <= level; lvl++) {
    const decor = decorForWealthLevel(lvl)
    if (!decor) continue
    events.push({
      type: 'wealthLevel',
      level: lvl,
      item: { kind: 'decor', speciesId: decor.id },
      carePoints: 0,
    })
  }
  if (level > nextMilestones.wealthLevel) nextMilestones.wealthLevel = level

  // Visit streak — one pet per threshold crossed.
  const longestStreak = profile?.room?.streak?.longest || 0
  const pet = petForStreak(longestStreak)
  if (pet && pet.streak > milestones.petStreak) {
    events.push({
      type: 'streak',
      streak: pet.streak,
      item: { kind: 'pet', speciesId: pet.id },
      carePoints: CARE_POINT_REWARDS.streakMilestone,
    })
    nextMilestones.petStreak = pet.streak
  }

  return { events, milestones: nextMilestones }
}
