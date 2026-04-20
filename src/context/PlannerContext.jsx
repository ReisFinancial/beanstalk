import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const PlannerContext = createContext(null)

const PROFILES_KEY = 'beanstalk.profiles'

const emptyProfile = {
  completedWizard: false,
  personal: {
    fullName: '',
    ageRange: '',
    lifeStage: '',
    location: '',
  },
  goals: [], // { id, title, horizon, category }
  priorities: [], // ordered list of goal ids
  finances: {
    monthlyIncome: '',
    monthlyExpenses: '',
    liquidAssets: '',
    investments: '',
    debts: '',
    riskTolerance: '', // low | medium | high
    savingsRate: '',
  },
  preferences: {
    focusArea: '', // money | career | health | relationships | learning
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

  const completeWizard = useCallback(() => {
    setProfile((prev) => ({ ...(prev || emptyProfile), completedWizard: true }))
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
      completeWizard,
      resetProfile,
    }),
    [profile, updateProfile, updateSection, setGoals, setPriorities, completeWizard, resetProfile],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider')
  return ctx
}
