import { Link } from 'react-router-dom'

function Feature({ emoji, title, children }) {
  return (
    <div className="card bg-card-gradient">
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-ink-500 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-hero-gradient shadow-glow" />
          <span className="font-display text-xl font-extrabold tracking-tight">Beanstalk</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost !py-2 !px-3 text-sm">Log in</Link>
          <Link to="/signup" className="btn-primary !py-2 !px-4 text-sm">Get started</Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-grape-400/30 blur-3xl" />
          <div className="absolute -top-20 right-0 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute top-40 left-1/3 h-72 w-72 rounded-full bg-peach-400/30 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-16 md:pt-20 md:pb-28 text-center">
          <span className="chip bg-white shadow-soft text-grape-700">
            <span>🌱</span> Grow the life you want
          </span>
          <h1 className="mt-6 font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            Plan what matters.<br />
            <span className="bg-hero-gradient bg-clip-text text-transparent">One decision at a time.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-ink-500 text-base md:text-lg">
            Beanstalk turns your goals and money into a clear, playful dashboard — so the next right step is always obvious.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/signup" className="btn-primary">Create your account →</Link>
            <Link to="/login" className="btn-secondary">I already have one</Link>
          </div>
          <p className="mt-4 text-xs text-ink-300">No credit card. Your data stays on this device.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature emoji="🎯" title="Clarity in 5 minutes">
            A short wizard captures what you care about — goals, horizons, priorities.
          </Feature>
          <Feature emoji="💸" title="Money in context">
            Drop in a quick financial snapshot; see room to breathe, save, and invest.
          </Feature>
          <Feature emoji="✨" title="A dashboard that answers">
            Your answers render as a living plan — tweak anything, any time.
          </Feature>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-ink-300">
        © {new Date().getFullYear()} Beanstalk · A decision-making companion.
      </footer>
    </div>
  )
}
