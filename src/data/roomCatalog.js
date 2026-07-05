/**
 * Static catalog for the cozy Room's unlockable items. Pure data — no
 * React, no profile mutation. utils/room.js reads this to decide what to
 * mint (unlockRoomItem) and what things cost (buyRoomItem). See
 * IMMERSIVE_GAMEPLAY.md for the design this implements.
 */

// ── Plants — one species per goal category, unlocked when a goal in that
// category reaches its target. Categories match Wizard.jsx's GOAL_CATEGORIES
// (debt/investment/spending/other) plus the legacy theme categories still
// found on older saved goals (money/career/health/learning/relationships/
// lifestyle, per Gameboard.jsx's GOAL_ICON map). ─────────────────────────
export const PLANT_SPECIES = {
  debt:          { id: 'debt',          label: 'Snake plant', emoji: '🪴', price: 40 },
  investment:    { id: 'investment',    label: 'Money tree',  emoji: '🌳', price: 40 },
  spending:      { id: 'spending',      label: 'Succulent',   emoji: '🌵', price: 40 },
  other:         { id: 'other',         label: 'Fern',        emoji: '🌿', price: 40 },
  money:         { id: 'money',         label: 'Money tree',  emoji: '🌳', price: 40 },
  career:        { id: 'career',        label: 'Bamboo',      emoji: '🎍', price: 40 },
  health:        { id: 'health',        label: 'Aloe',        emoji: '🌱', price: 40 },
  learning:      { id: 'learning',      label: 'Ivy',         emoji: '🍃', price: 40 },
  relationships: { id: 'relationships', label: 'Peony',       emoji: '🌸', price: 40 },
  lifestyle:     { id: 'lifestyle',     label: 'Palm',        emoji: '🌴', price: 40 },
}

export function plantSpeciesForGoalCategory(category) {
  return PLANT_SPECIES[category] || PLANT_SPECIES.other
}

// ── Decor — tiered by liquid-net-worth wealth level (0–6, see
// WealthMark.jsx WEALTH_LEVELS). One piece unlocks the first time the user
// crosses into each tier. ────────────────────────────────────────────────
export const DECOR_BY_WEALTH_LEVEL = [
  { level: 0, id: 'decor-0', label: 'Reading lamp',   emoji: '💡', price: 20 },
  { level: 1, id: 'decor-1', label: 'Throw blanket',  emoji: '🧶', price: 30 },
  { level: 2, id: 'decor-2', label: 'Area rug',       emoji: '🟫', price: 50 },
  { level: 3, id: 'decor-3', label: 'Bookshelf',      emoji: '📚', price: 80 },
  { level: 4, id: 'decor-4', label: 'Fireplace',      emoji: '🔥', price: 120 },
  { level: 5, id: 'decor-5', label: 'Grand piano',    emoji: '🎹', price: 180 },
  { level: 6, id: 'decor-6', label: 'Skyline window', emoji: '🌆', price: 260 },
]

export function decorForWealthLevel(level) {
  return DECOR_BY_WEALTH_LEVEL.find((d) => d.level === level) || null
}

// ── Pets — unlocked at visit-streak milestones (profile.room.streak). Free
// to place — the streak itself is the cost. ─────────────────────────────
export const PETS_BY_STREAK = [
  { streak: 7,  id: 'pet-7',  label: 'Kitten', emoji: '🐈', price: 0 },
  { streak: 30, id: 'pet-30', label: 'Puppy',  emoji: '🐕', price: 0 },
  { streak: 90, id: 'pet-90', label: 'Rabbit', emoji: '🐇', price: 0 },
]

// Highest threshold met, not the next one up — so a streak that's already
// long doesn't have to "collect" every smaller milestone it passed.
export function petForStreak(streakDays) {
  const days = Number(streakDays) || 0
  let best = null
  for (const p of PETS_BY_STREAK) {
    if (days >= p.streak) best = p
  }
  return best
}

// ── Food/cooking — small cosmetic flourish for the daily visit itself,
// independent of financial data, so there's always something pleasant on a
// quiet day. Picked at random from a small rotating set. ────────────────
export const FOOD_FLOURISHES = [
  { id: 'food-tea',    label: 'Cup of tea',   emoji: '🍵' },
  { id: 'food-bread',  label: 'Fresh bread',  emoji: '🍞' },
  { id: 'food-soup',   label: 'Bowl of soup', emoji: '🍲' },
  { id: 'food-cookie', label: 'Cookies',      emoji: '🍪' },
  { id: 'food-fruit',  label: 'Fruit bowl',   emoji: '🍎' },
]

export function randomFoodFlourish() {
  return FOOD_FLOURISHES[Math.floor(Math.random() * FOOD_FLOURISHES.length)]
}

// ── Seasons — v1 derives these from the user's own trailing net-worth/goal
// trend (see utils/room.js computeSeason), not live external market data.
// `hint` is the short, friendly explainer shown in SeasonBanner. ─────────
export const SEASONS = {
  spring: { id: 'spring', label: 'Spring', emoji: '🌷', hint: 'Steady growth' },
  summer: { id: 'summer', label: 'Summer', emoji: '☀️', hint: 'Strong growth' },
  autumn: { id: 'autumn', label: 'Autumn', emoji: '🍂', hint: 'Cooling off' },
  winter: { id: 'winter', label: 'Winter', emoji: '❄️', hint: 'A sustained downturn' },
  storm:  { id: 'storm',  label: 'Storm',  emoji: '⛈️', hint: 'A sharp drop' },
}

// ── Lookup — given a room item's `{ kind, speciesId }`, find its catalog
// entry (label/emoji/price) regardless of which list it lives in. ───────
export function catalogEntry(kind, speciesId) {
  switch (kind) {
    case 'plant': return Object.values(PLANT_SPECIES).find((s) => s.id === speciesId) || null
    case 'decor': return DECOR_BY_WEALTH_LEVEL.find((d) => d.id === speciesId) || null
    case 'pet':   return PETS_BY_STREAK.find((p) => p.id === speciesId) || null
    case 'food':  return FOOD_FLOURISHES.find((f) => f.id === speciesId) || null
    default:      return null
  }
}

// ── Care-point earn rates — how many points each engagement action mints.
// Centralized here so tuning the economy doesn't require touching UI or
// PlannerContext code. ───────────────────────────────────────────────────
export const CARE_POINT_REWARDS = {
  dailyVisit: 5,
  tendItem: 2,
  actionPlanItemDone: 10,
  goalCompleted: 50,
  streakMilestone: 25,
}
