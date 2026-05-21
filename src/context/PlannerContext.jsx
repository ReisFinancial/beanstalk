import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const PlannerContext = createContext(null)

const PROFILES_KEY = 'beanstalk.profiles'

const emptyProfile = {
  completedWizard: false,
  personal: {
    fullName: '',
    ageRange: '',
    lifeStage: [], // multi-select — array of stage labels
    country: '',   // 'CA' | 'US'
    region: '',    // province (CA) or state (US)
  },
  goals: [], // { id, title, horizon, category }
  priorities: [], // ordered list of goal ids
  assets: [], // { id, label, amount, note? }
  liabilities: [], // { id, label, amount, note? }
  snapshotSeeded: false, // true once we've seeded assets/liabilities from wizard finances
  // Monthly check-in history — each entry is a point-in-time snapshot
  // { date: 'YYYY-MM-DD', finances: {...}, netWorth: number, savingsRate: number }
  checkIns: [],
  lastCheckIn: null, // ISO date string of most recent check-in
  finances: {
    monthlyIncome: '',
    monthlyExpenses: '',
    bareNecessities: '', // fixed monthly expenditures (rent, utilities, etc.)
    liquidAssets: '',
    investments: '',
    realEstate: '',
    debts: '',
    riskTolerance: '', // low | medium | high
    savingsRate: '',
  },
  // Typical return / interest rates applied per type. Values are percentages
  // stored as strings (so the inputs stay controlled); Number() them at read time.
  rates: {
    asset: {
      savings: '',
      retirement: '',
      investments: '',
      realEstate: '',
      crypto: '',
    },
    liability: {
      creditCard: '',
      lineOfCredit: '',
      overdueBills: '',
      carLoan: '',
      mortgage: '',
    },
  },
  preferences: {
    focusArea: '', // money | career | health | relationships | learning
  },
  gamification: {
    xp: 0,
    checkInStreak: 0,
    lastLevelSeen: null,
  },
}

function readProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}')
  } catch {
    return {}
  }
}
function writeProfiles(map) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(map))
}

export function PlannerProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  // Load the profile tied to the current user
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    const all = readProfiles()
    setProfile(all[user.id] || { ...emptyProfile })
  }, [user])

  // Persist whenever the profile changes
  useEffect(() => {
    if (!user || !profile) return
    const all = readProfiles()
    all[user.id] = profile
    writeProfiles(all)
  }, [user, profile])

  const updateProfile = useCallback((patch) => {
    setProfile((prev) => ({ ...(prev || emptyProfile), ...patch }))
  }, [])

  const updateSection = useCallback((section, patch) => {
    setProfile((prev) => {
      const base = prev || emptyProfile
      return { ...base, [section]: { ...base[section], ...patch } }
    })
  }, [])

  const setGoals = useCallback((goals) => {
    setProfile((prev) => ({ ...(prev || emptyProfile), goals }))
  }, [])

  const setPriorities = useCallback((priorities) => {
    setProfile((prev) => ({ ...(prev || emptyProfile), priorities }))
  }, [])

  const addGoal = useCallback((goal) => {
    setProfile((prev) => {
      const base = prev || emptyProfile
      const next = { id: crypto.randomUUID(), ...goal }
      return {
        ...base,
        goals: [...base.goals, next],
        priorities: [...(base.priorities || []), next.id],
      }
    })
  }, [])

  const removeGoal = useCallback((id) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        goals: prev.goals.filter((g) => g.id !== id),
        priorities: (prev.priorities || []).filter((x) => x !== id),
      }
    })
  }, [])

  const updateGoal = useCallback((id, patch) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        goals: (prev.goals || []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }
    })
  }, [])

  const addAsset = useCallback((asset) => {
    setProfile((prev) => {
      const base = prev || emptyProfile
      return {
        ...base,
        assets: [...(base.assets || []), { id: crypto.randomUUID(), ...asset }],
      }
    })
  }, [])

  const removeAsset = useCallback((id) => {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, assets: (prev.assets || []).filter((a) => a.id !== id) }
    })
  }, [])

  const updateAsset = useCallback((id, patch) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        assets: (prev.assets || []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }
    })
  }, [])

  const addLiability = useCallback((liability) => {
    setProfile((prev) => {
      const base = prev || emptyProfile
      return {
        ...base,
        liabilities: [...(base.liabilities || []), { id: crypto.randomUUID(), ...liability }],
      }
    })
  }, [])

  const removeLiability = useCallback((id) => {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, liabilities: (prev.liabilities || []).filter((l) => l.id !== id) }
    })
  }, [])

  const updateLiability = useCallback((id, patch) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        liabilities: (prev.liabilities || []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }
    })
  }, [])

  // Rates: update a single rate (scope = 'asset' | 'liability', key = type id)
  const updateRate = useCallback((scope, key, value) => {
    setProfile((prev) => {
      const base = prev || emptyProfile
      const currentRates = base.rates || emptyProfile.rates
      return {
        ...base,
        rates: {
          ...currentRates,
          [scope]: {
            ...(currentRates[scope] || {}),
            [key]: value,
          },
        },
      }
    })
  }, [])

  // Seed assets/liabilities from wizard finances once, so the snapshot
  // isn't empty the first time the user visits it.
  const seedFromFinances = useCallback(() => {
    setProfile((prev) => {
      if (!prev || prev.snapshotSeeded) return prev
      const assets = [...(prev.assets || [])]
      const liabilities = [...(prev.liabilities || [])]
      const liquid     = Number(prev.finances?.liquidAssets) || 0
      const inv        = Number(prev.finances?.investments)  || 0
      const realEstate = Number(prev.finances?.realEstate)   || 0
      const debts      = Number(prev.finances?.debts)        || 0
      if (liquid > 0)     assets.push({ id: crypto.randomUUID(), label: 'Liquid savings', amount: liquid,     subtype: 'savings',     note: 'From wizard' })
      if (inv > 0)        assets.push({ id: crypto.randomUUID(), label: 'Investments',    amount: inv,        subtype: 'investments', note: 'From wizard' })
      if (realEstate > 0) assets.push({ id: crypto.randomUUID(), label: 'Real estate',    amount: realEstate, subtype: 'realEstate',  note: 'From wizard' })
      if (debts > 0)      liabilities.push({ id: crypto.randomUUID(), label: 'Debts',     amount: debts,      subtype: 'creditCard',  note: 'From wizard' })
      return { ...prev, assets, liabilities, snapshotSeeded: true }
    })
  }, [])

  const completeWizard = useCallback(() => {
    setProfile((prev) => {
      if (!prev) return prev
      // Seed hexes inline so they're ready the moment the dashboard opens.
      const base = { ...prev, completedWizard: true }
      if (base.snapshotSeeded) return base
      const assets = [...(base.assets || [])]
      const liabilities = [...(base.liabilities || [])]
      const liquid     = Number(base.finances?.liquidAssets) || 0
      const inv        = Number(base.finances?.investments)  || 0
      const realEstate = Number(base.finances?.realEstate)   || 0
      const debts      = Number(base.finances?.debts)        || 0
      if (liquid > 0)     assets.push({ id: crypto.randomUUID(), label: 'Liquid savings', amount: liquid,     subtype: 'savings',     note: 'From wizard' })
      if (inv > 0)        assets.push({ id: crypto.randomUUID(), label: 'Investments',    amount: inv,        subtype: 'investments', note: 'From wizard' })
      if (realEstate > 0) assets.push({ id: crypto.randomUUID(), label: 'Real estate',    amount: realEstate, subtype: 'realEstate',  note: 'From wizard' })
      if (debts > 0)      liabilities.push({ id: crypto.randomUUID(), label: 'Debts',     amount: debts,      subtype: 'creditCard',  note: 'From wizard' })
      return { ...base, assets, liabilities, snapshotSeeded: true }
    })
  }, [])

  // Log an actual contribution or payment against a specific asset/liability.
  // Updates the item's balance and appends to its contributions[] history.
  const logContribution = useCallback((type, id, { amount, note = '' }) => {
    const n = Number(amount)
    if (!n || n <= 0) return
    const entry = {
      id:     crypto.randomUUID(),
      date:   new Date().toISOString().slice(0, 10),
      amount: n,
      note,
    }
    setProfile((prev) => {
      if (!prev) return prev
      if (type === 'asset') {
        return {
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === id
              ? { ...a, amount: (Number(a.amount) || 0) + n, contributions: [...(a.contributions || []), entry] }
              : a
          ),
        }
      }
      // liability: payment reduces the balance, floor at 0
      return {
        ...prev,
        liabilities: prev.liabilities.map((l) =>
          l.id === id
            ? { ...l, amount: Math.max(0, (Number(l.amount) || 0) - n), contributions: [...(l.contributions || []), entry] }
            : l
        ),
      }
    })
  }, [])

  const awardXp = useCallback((amount) => {
    setProfile((prev) => {
      if (!prev) return prev
      const g = prev.gamification || {}
      return { ...prev, gamification: { ...g, xp: (g.xp || 0) + amount } }
    })
  }, [])

  const markLevelSeen = useCallback((level) => {
    setProfile((prev) => {
      if (!prev) return prev
      const g = prev.gamification || {}
      return { ...prev, gamification: { ...g, lastLevelSeen: level } }
    })
  }, [])

  // Save a monthly check-in. Updates finances, appends snapshot, awards XP + streak.
  const saveCheckIn = useCallback((newFinances) => {
    setProfile((prev) => {
      if (!prev) return prev
      const inc   = Number(newFinances.monthlyIncome)  || 0
      const exp   = Number(newFinances.monthlyExpenses) || 0
      const cash  = Number(newFinances.liquidAssets)    || 0
      const inv   = Number(newFinances.investments)     || 0
      const re    = Number(newFinances.realEstate)      || 0
      const debt  = Number(newFinances.debts)           || 0
      const savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0
      const netWorth    = cash + inv + re - debt
      const today = new Date().toISOString().slice(0, 10)
      const entry = { date: today, finances: { ...newFinances }, netWorth, savingsRate }

      // Streak: consecutive months of check-ins
      const lastDate = prev.lastCheckIn ? new Date(prev.lastCheckIn + 'T00:00:00') : null
      const now = new Date()
      const isConsecutive = lastDate && (
        (lastDate.getFullYear() === now.getFullYear() && lastDate.getMonth() === now.getMonth() - 1) ||
        (lastDate.getMonth() === 11 && now.getMonth() === 0 && lastDate.getFullYear() === now.getFullYear() - 1)
      )
      const g = prev.gamification || {}
      const newStreak = isConsecutive ? (g.checkInStreak || 0) + 1 : 1

      return {
        ...prev,
        finances: { ...prev.finances, ...newFinances },
        checkIns: [...(prev.checkIns || []), entry],
        lastCheckIn: today,
        gamification: { ...g, xp: (g.xp || 0) + 100, checkInStreak: newStreak },
      }
    })
  }, [])

  const resetProfile = useCallback(() => {
    setProfile({ ...emptyProfile })
  }, [])

  const value = useMemo(
    () => ({
      profile,
      updateProfile,
      updateSection,
      setGoals,
      setPriorities,
      addGoal,
      removeGoal,
      updateGoal,
      addAsset,
      removeAsset,
      updateAsset,
      addLiability,
      removeLiability,
      updateLiability,
      updateRate,
      seedFromFinances,
      completeWizard,
      logContribution,
      saveCheckIn,
      awardXp,
      markLevelSeen,
      resetProfile,
    }),
    [
      profile, updateProfile, updateSection, setGoals, setPriorities,
      addGoal, removeGoal, updateGoal,
      addAsset, removeAsset, updateAsset,
      addLiability, removeLiability, updateLiability,
      updateRate, seedFromFinances, completeWizard, logContribution, saveCheckIn,
      awardXp, markLevelSeen, resetProfile,
    ],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider')
  return ctx
}
