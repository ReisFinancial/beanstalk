# Immersive Gameplay — Cozy Room

Design notes for turning the Play section from a numbers-first sandbox into a
cozy, low-stress room-decorating game that reflects real financial behavior.
This doc is the working spec for the `immersive-gameplay-v1` branch — update
it as decisions change instead of leaving them stranded in chat history.

## Pitch

Users tend a small room — water plants, feed a pet, cook something small —
as a daily ritual. The room's condition and growth are driven by real
financial behavior (completing action-plan steps, hitting goals, consistent
engagement) instead of by manually "gaming" the room. Neglect is gentle and
reversible: nothing is ever punished harshly, because the whole point is to
reduce financial stress, not add to it.

## V1 scope (this branch)

- [x] Cozy room is the **primary Play view**. The existing hex sandbox
      (`Gameboard.jsx`, "Net Worth Arena") moves to a secondary "Sandbox"
      toggle for users who want the advanced what-if tool. — `Room.jsx` is
      now the `/play` route; `Gameboard.jsx` is reachable both ways via a
      "Sandbox"/"Room" link in each page's header.
- [x] Single room that grows over time (not multiple rooms/houses yet). —
      `RoomScene.jsx` renders everything currently placed.
- [x] Active daily tending ritual (tap to water/feed) — passive-only updates
      don't give a reason to open the app on a day with no financial news. —
      per-tile Water/Feed buttons in `RoomItem.jsx`; `useRoomVisit.js` grants
      the daily cosmetic reward once per calendar day.
- [x] Seasons driven by economic conditions (bear market → winter, a market
      shock/"global event" → storm, etc.) — v1 approach shipped
      (`computeSeason` in `utils/room.js`, using the user's own trailing net
      worth, not live external market data — see Seasons section below for
      the future upgrade path).
- [x] Micro-economy: care points earned from engagement, spent in a shop to
      choose/place decor rather than everything auto-placing itself. —
      `DecorShop.jsx` + `buyRoomItem`, verified end-to-end (points deducted,
      item moves from shop into the room).
- [x] Reduced-motion toggle for users who find the gamification itself
      stressful, or who just prefer calmer UI. — `ReducedMotionToggle.jsx` in
      `Room.jsx`'s header, resolved by `useReducedMotion.js` ('system' tracks
      the OS `prefers-reduced-motion` media query live; 'on'/'off' override
      it). Wired via a blanket `.motion-reduce-scope` CSS override
      (`index.css`) rather than threading a boolean through every animated
      component.
- [x] Gentle, cosmetic, reversible neglect — never a destructive/"game over"
      state. — decay floors at 25 (never 0), one watering fully restores an
      item, and `unplaceRoomItem` only ever stores items, never deletes them.

## Core loop

1. **Daily/session loop** — the reason to open the app *today*. Tend
   whatever needs tending (water a plant, feed the pet). Low effort, always
   available, always at least a little pleasant even with no financial news.
2. **Weekly/behavioral loop** — real financial upkeep (checking off an
   `actionPlan` item, logging a contribution, staying on budget) grows the
   room. This is the loop that reinforces the actual money habit.
3. **Milestone loop** — hitting a real goal (debt paid off, an investment
   target reached, an emergency fund funded) unlocks something big and
   discrete: a new piece of furniture, a pet, a room expansion. Rare and
   celebratory.

## Signal → reward mapping

| Trigger (existing data) | Reward |
|---|---|
| Check off an `actionPlan` item | Tend/grow an existing plant |
| A goal (`profile.goals`) reaches its target | New plant, species tied to the goal's category (debt/investment/spending/other) |
| Engagement streak (7 / 30 / 90 days) | Pet or decor unlock |
| Net worth or savings-rate improvement | Decor upgrade / care points |
| Daily visit alone, nothing financial changed | Small cosmetic food/cooking flourish — keeps the ritual alive on quiet days |
| `buyingPowerAssessment` (contentment rating) | Ambient room mood — lighting warmth / tidiness, not a hard item |

## Seasons (economic-data-driven)

Bear-market conditions → winter. A market shock / crash → a storm. Bull
run/strong growth → spring or summer. This is one of the more open technical
questions:

- **v1 approach (recommended):** derive "season" from the *user's own*
  trailing net-worth / goal-progress trend (something we already compute
  locally, no network calls, no API keys). A sustained multi-week decline in
  net worth or a sharp single-period drop reads as winter/storm; sustained
  growth reads as spring/summer. This keeps the feature fully local and
  buildable immediately.
- **Future upgrade:** layer in real external market data (e.g. a broad index
  drawdown %) behind a feature flag once there's a backend/proxy to fetch it
  through safely (a browser-side fetch to a market API has CORS/key-exposure
  problems — needs a small server-side proxy). Real data would apply to
  everyone at once (a shared "world weather"), which is also a natural setup
  for the future multiplayer/community layer below.

## Micro-economy (care points)

Every tending action, streak milestone, and goal completion earns **care
points**. Rather than auto-placing every unlock, most decor/plants land in a
"shop"/inventory first — the user spends care points to buy and place items,
and can rearrange the room. This adds agency and a browsing/decision loop
without needing real money or a backend wallet.

## Neglect, handled gently

- Decay is **cosmetic and reversible** — a wilted plant perks up after one
  watering; nothing already unlocked is ever permanently lost.
- Neglect reflects *disengagement* (time since last visit), not "you're bad
  with money." A real financial setback should never be the thing that makes
  the room look sad — that would work against the stress-reduction goal.
- A short grace period (2–3 days) before any visible neglect state, so nothing
  feels twitchy or naggy.
- A reduced-motion / low-key setting turns down animation and urgency for
  users who find the game layer itself stressful.

## Deferred — future ideas (not v1, keep for later)

- **Multiplayer via wealth levels, as a networking/community mechanic.**
  Reusing the existing `WEALTH_LEVELS` (0–6) from `WealthMark.jsx`:
  - Levels 0–1: an apartment to decorate (starter scope).
  - Levels 2–3: a full home.
  - Level 4+: a condo — and crucially, players at levels 0–1 could *live in*
    a level-4+ player's condo, visiting/decorating a guest room there.
  - Level 4+ spaces are themed by the industry/specialty the player
    succeeded in (finance, tech, real estate, etc.), so lower-level players
    can choose an industry to "move into" and engage with players who are
    further along in that specific field — a mentorship/community-leadership
    angle rather than pure status display.
  - Needs real backend + accounts before any of this is possible (today
    everything is per-browser `localStorage`) — this is the natural forcing
    function for finally standing up a backend.
- Real external market data driving a shared/"world" season instead of a
  per-user proxy (see Seasons above).
- Mascot with a written voice/personality (small companion, could reuse the
  `BeanstalkMark` sprout) — gentle, non-judgmental copy ("the fern's looking
  thirsty" rather than "you missed 3 days").
- Achievement/trophy shelf — permanent record of past milestones, separate
  from the room itself, so decay cycles never feel like erasing progress.
- Seasonal/limited cosmetic decor tied to real calendar time, independent of
  financial data, to give a reason to check in even when finances are static.
- Photo/share mode for the room.

## V1 technical sketch

Status: the core loop (visit → earn → tend → shop → place) is built and
verified end-to-end. What follows reflects what actually shipped, including
a few departures from the original sketch — noted inline.

### Data model — `profile.room` (in `PlannerContext.jsx`)

```
room: {
  season: {
    current: 'spring' | 'summer' | 'autumn' | 'winter' | 'storm',
    source: 'auto',          // 'auto' now; 'world' once real market data lands
    updatedAt: ISO string,
    baselineNetWorth,        // comparison point for the next season check
  },
  carePoints: 0,
  streak: { current: 0, longest: 0, lastVisitDate: null },
  items: [
    {
      id,
      kind: 'plant' | 'decor' | 'pet' | 'food',
      speciesId,           // key into the static catalog (art/tier/price)
      sourceGoalId,        // optional — set when unlocked via a specific goal
      unlockedAt,
      placed: boolean,     // owned vs. actually placed in the room (shop model)
      slotId,              // reserved for a future layout step — unused in v1
      lastTendedAt,
      // No stored careLevel — it's derived from lastTendedAt at render time
      // (utils/room.js#decayCareLevel) so it can't drift out of sync.
    },
  ],
  // What's already been granted, so milestone detection never re-grants the
  // same goal/tier/streak twice. Not in the original sketch — needed once
  // unlocksFromMilestones had to be safe to call on every single visit.
  milestones: { goalIds: [], wealthLevel: -1, petStreak: 0 },
  settings: {
    reducedMotion: 'system' | 'on' | 'off',
  },
},
```

Follows the existing `PlannerContext` pattern (like `assets`/`liabilities`).
Existing profiles saved before this feature existed lack a `room` key
entirely — the load path shallow-merges over `emptyProfile` so it backfills
instead of being `undefined` (verified: a seeded profile with no `room` key
loaded and unlocked correctly).

Action helpers on `PlannerContext`: `recordVisit`, `tendItem`,
`unlockRoomItem`, `buyRoomItem(id, cost, slotId)`, `unplaceRoomItem`,
`addCarePoints`, `setReducedMotion`.

### Static catalog — `src/data/roomCatalog.js`

Plant species per goal category, decor tiers per wealth level / net-worth
threshold, pet unlocks per streak tier, care-point shop prices, and
`catalogEntry(kind, speciesId)` — a unified lookup so components don't need
to know which list an item's species lives in.

### Pure logic — `src/utils/room.js`

- `decayCareLevel(item, now)` / `careState(level)` — time-based decay (2-day
  grace, 7-day falloff to a floor of 25 — never fully "dies"), bucketed into
  `thriving`/`okay`/`wilted` for rendering.
- `currentNetWorth(profile)` — raw assets-minus-liabilities.
- `computeSeason(profile, now)` — derives season from the user's own trailing
  net-worth trend, rechecking at most every 3 days so it doesn't flap.
- `dailyVisitReward()` — the always-available cosmetic reward for showing up.
- `unlocksFromMilestones(profile)` — **departure from the sketch**: takes
  just `profile`, not a before/after diff. It reads `room.milestones` (goals
  already granted, highest wealth tier granted, highest streak tier granted)
  to detect *new* milestones idempotently, so it's safe to call on every
  visit without an external "previous state" to compare against.

### Composition — `src/hooks/useRoomVisit.js` (not in the original sketch)

Runs the "you opened the Room today" side effects: `recordVisit`, the daily
reward, `computeSeason`, and `unlocksFromMilestones`, applying results via
the `PlannerContext` helpers above. Added because something had to own the
glue between the pure `utils/room.js` functions and the stateful context —
didn't fit naturally in either.

### Components — `src/components/room/`

- `RoomScene.jsx` — season-tinted background + grid of currently-placed
  items. `slotId` isn't read yet — v1 lays items out in array order.
- `RoomItem.jsx` — a single tile; care-state chip + Water/Feed button for
  plants/pets only (decor and food don't decay).
- `DecorShop.jsx` — lists unplaced inventory with prices, spends care points
  via `buyRoomItem`.
- `ReducedMotionToggle.jsx` — three-way (`system`/`on`/`off`) control in
  `Room.jsx`'s header; paired with `src/hooks/useReducedMotion.js`.
- Not yet built: `TendingPanel` (a compact "what needs attention today"
  summary — basic tending already works via each `RoomItem`'s own button),
  `SeasonBanner` (a fuller explainer than `RoomScene`'s inline season chip),
  `StreakBadge` (currently just a plain stat chip in `Room.jsx`).

### Pages / routing — done

- `src/pages/Room.jsx` — the primary Play view at `/play`.
- `Gameboard.jsx` unchanged internally; reachable via a "Sandbox" link in
  `Room.jsx`'s header, with a reciprocal "Room" link added to its own header.
- `Layout.jsx` nav's "Play" tab points at `/play` (icon 🎮→🌱); `/gameboard`
  still counts as "Play" for nav-highlight purposes.

### Visual style

Reuse the existing flat-illustration language from `Hex.jsx`/`WealthMark.jsx`
(charcoal-bordered shapes, soft gradients, rounded corners) so the room reads
as part of the same product rather than a bolted-on art style. Neglect uses
muted slate tones rather than the app's red "bad" tone, deliberately — it
signals disengagement, not a financial warning.
