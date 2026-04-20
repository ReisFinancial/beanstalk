import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const USERS_KEY = 'beanstalk.users'
const SESSION_KEY = 'beanstalk.session'

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// NOTE: frontend-only stub. Passwords are hashed with a weak in-browser hash
// so they aren't stored in cleartext, but this is NOT secure — a real backend
// must handle auth in production.
async function hash(str) {
  const buf = new TextEncoder().encode(str)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const signup = useCallback(async ({ email, username, password }) => {
    const users = readUsers()
    const e = email.trim().toLowerCase()
    const u = username.trim()
    if (users.find((x) => x.email === e)) {
      throw new Error('An account with that email already exists.')
    }
    if (users.find((x) => x.username.toLowerCase() === u.toLowerCase())) {
      throw new Error('That username is taken.')
    }
    const record = {
      id: crypto.randomUUID(),
      email: e,
      username: u,
      passwordHash: await hash(password),
      createdAt: new Date().toISOString(),
    }
    writeUsers([...users, record])
    const session = { id: record.id, email: record.email, username: record.username }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return session
  }, [])

  const login = useCallback(async ({ identifier, password }) => {
    const users = readUsers()
    const id = identifier.trim().toLowerCase()
    const match = users.find(
      (x) => x.email === id || x.username.toLowerCase() === id,
    )
    if (!match) throw new Error('No account found for that email or username.')
    const passwordHash = await hash(password)
    if (match.passwordHash !== passwordHash) throw new Error('Incorrect password.')
    const session = { id: match.id, email: match.email, username: match.username }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return session
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signup, login, logout }),
    [user, loading, signup, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
