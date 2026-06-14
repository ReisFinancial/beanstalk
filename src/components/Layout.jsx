import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlanner } from '../context/PlannerContext.jsx'
import BeanstalkMark from './BeanstalkMark.jsx'

function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BeanstalkMark className="h-8 w-8 text-olive-600" />
      <span className="font-display text-xl font-extrabold tracking-tight">Beanstalk</span>
    </div>
  )
}

const navItems = [
  { key: 'home',     to: '/dashboard',                label: 'Dashboard', icon: '🏡' },
  { key: 'snapshot', to: '/dashboard?view=snapshot',  label: 'Snapshot',  icon: '🔷' },
  { key: 'goals',    to: '/dashboard?view=goals',     label: 'Goals',     icon: '🎯' },
  { key: 'money',    to: '/dashboard?view=money',     label: 'Money',     icon: '💸' },
  { key: 'play',     to: '/gameboard',                label: 'Play',      icon: '🎮' },
  { key: 'profile',  to: '/dashboard?view=profile',   label: 'Profile',   icon: '🙂' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { profile } = usePlanner()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const onDashboard = location.pathname === '/dashboard'
  const onGameboard = location.pathname === '/gameboard'
  const currentView = searchParams.get('view') || 'home'

  const isActive = (key) => {
    if (key === 'play') return onGameboard
    return onDashboard && currentView === key
  }

  // Outstanding action-plan steps drive the badge on the Play nav item so
  // the user gets pulled back to follow through on what they planned.
  const playPending = (profile?.actionPlan || []).filter((a) => !a.done).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop + tablet top bar */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.key)
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`relative px-3 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-grape-100 text-grape-700'
                      : 'text-ink-500 hover:text-ink-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>{item.label}
                  {item.key === 'play' && playPending > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-grape-600 text-white text-[10px] font-bold align-middle">
                      {playPending}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs text-ink-300">Signed in as</span>
              <span className="text-sm font-semibold">{user?.username}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/') }}
              className="btn-ghost !py-2 !px-3 text-sm"
              aria-label="Log out"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200
                   pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-6">
          {navItems.map((item) => {
            const active = isActive(item.key)
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold ${
                    active ? 'text-grape-700' : 'text-ink-500'
                  }`}
                >
                  <span className="relative text-lg leading-none">
                    {item.icon}
                    {item.key === 'play' && playPending > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-grape-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {playPending}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
