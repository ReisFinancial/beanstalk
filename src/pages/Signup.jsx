import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const on = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.'
    if (form.username.length < 3) return 'Username must be at least 3 characters.'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Username may only contain letters, numbers, and underscores.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    if (form.password !== form.confirm) return 'Passwords do not match.'
    return ''
  }

  const strength = (() => {
    const p = form.password
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^a-zA-Z0-9]/.test(p)) s++
    return s // 0..4
  })()
  const strengthLabel = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent'][strength]
  const strengthColor = ['bg-slate-200', 'bg-red-400', 'bg-amber-400', 'bg-brand-500', 'bg-brand-600'][strength]

  const submit = async (e) => {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }
    setSubmitting(true); setError('')
    try {
      await signup({ email: form.email, username: form.username, password: form.password })
      navigate('/wizard', { replace: true })
    } catch (err) {
      setError(err.message || 'Signup failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Takes about 30 seconds. Nothing leaves your browser."
      footer={<>Already have an account? <Link className="font-semibold text-grape-700" to="/login">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="input"
                 placeholder="you@example.com" value={form.email} onChange={on('email')} required />
        </div>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" type="text" autoComplete="username" className="input"
                 placeholder="rafael" value={form.username} onChange={on('username')} required />
          <p className="mt-1 text-xs text-ink-300">Letters, numbers, and underscores only.</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" className="input"
                 placeholder="At least 8 characters" value={form.password} onChange={on('password')} required />
          {form.password && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${strengthColor} transition-all`}
                  style={{ width: `${(strength / 4) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">Strength: {strengthLabel}</p>
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" className="input"
                 placeholder="Re-enter your password" value={form.confirm} onChange={on('confirm')} required />
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-ink-300">
          By continuing you agree to the friendly terms of your own good judgment.
        </p>
      </form>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-hero-gradient shadow-glow" />
          <span className="font-display text-xl font-extrabold tracking-tight">Beanstalk</span>
        </Link>
      </div>

      <div className="mx-auto max-w-md px-4 pt-6 pb-20">
        <div className="card">
          <h1 className="font-display text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-500 text-sm">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <p className="mt-5 text-center text-sm text-ink-500">{footer}</p>
        )}
      </div>
    </div>
  )
}
