/**
 * Templated options shared between the wizard (where users rank them) and
 * the dashboard / downstream views (where the ranking is displayed).
 *
 * HOBBY_TEMPLATES    — Step 3 hobby categories, ranked into
 *                      lifestyleGoal.hobbyRanking.
 * PRIORITY_TEMPLATES — Step 5 priorities, ranked into profile.priorityRanking.
 */

export const HOBBY_TEMPLATES = [
  { id: 'active',  emoji: '🏞️', title: 'Active',  detail: 'Sports, outdoors, and nature.' },
  { id: 'social',  emoji: '🍸', title: 'Social',  detail: 'Nights out with friends.' },
  { id: 'luxury',  emoji: '🛍️', title: 'Luxury',  detail: 'Retail and collectibles.' },
  { id: 'digital', emoji: '🎮', title: 'Digital', detail: 'Games and screens.' },
  { id: 'culture', emoji: '🎭', title: 'Culture', detail: 'Theatre and the arts.' },
]

export const PRIORITY_TEMPLATES = [
  { id: 'security',   emoji: '🛡️', title: 'Freedom from a paycheck',          detail: 'Own my time. Answer to no one.' },
  { id: 'loved_ones', emoji: '❤️',  title: 'Fully present for the ones I love', detail: 'No screens. No pings. Just me.' },
  { id: 'lifestyle',  emoji: '✨',  title: 'A life without price tags',         detail: 'Say yes without doing the math.' },
  { id: 'wealth',     emoji: '📈',  title: 'Wealth that outlasts me',           detail: 'Compound now. Coast later. Leave a legacy.' },
  { id: 'home',       emoji: '🏡',  title: 'A home worth never leaving',        detail: 'Everything I love, under one roof.' },
]
