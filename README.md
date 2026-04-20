# Beanstalk 🌱

A desktop-first, mobile-responsive planning app built with **Vite + React + Tailwind CSS**. Users sign up, run through a 6-step wizard (goals, priorities, a quick financial snapshot), and land on a personalized dashboard.

This is a **frontend-only** prototype: auth and user data live in the browser's `localStorage` under a simple stub so you can click through the whole flow without a server. See [Wiring a real backend](#wiring-a-real-backend) when you're ready to promote it.

---

## Run it

```bash
# 1. Install
npm install

# 2. Start the dev server
npm run dev

# 3. Open the URL Vite prints (typically http://localhost:5173)
```

Production build:

```bash
npm run build     # outputs to dist/
npm run preview   # serves the built bundle locally
```

---

## Feature map

- **Landing page** with modern gradient hero, feature cards, and CTAs.
- **Signup** — email, username, password + confirm, with inline validation and a live password-strength meter.
- **Login** — accepts either email or username.
- **Protected routing** — unauthenticated users are redirected to `/login`; authenticated users with an incomplete wizard are sent to `/wizard`.
- **6-step wizard** with a progress bar:
  1. Welcome (name + primary focus area)
  2. About you (age range, life stage, location)
  3. Goals (add custom or pick from suggestions; category + horizon)
  4. Priorities (rank your goals; top 3 are highlighted)
  5. Money snapshot (income, expenses, liquid savings, investments, debts, risk tolerance — with a live savings-rate readout)
  6. Review (everything you entered, summarized)
- **Personalized dashboard** with four views switchable from the nav:
  - Home — stats, top-3 goals, and next-step suggestions tuned to your answers.
  - Goals — full ranked list.
  - Money — income/expenses, savings rate, runway (months of expenses covered by cash), net position.
  - Profile — personal details, with a shortcut to rerun the wizard.
- **Responsive layout** — max-width container + top bar on desktop/tablet; a sticky bottom tab bar on mobile with safe-area insets for notched devices.
- **Playful modern style** — gradient brand mark, soft shadows, rounded-2xl/3xl cards, Plus Jakarta Sans for display + Inter for body.

---

## Project layout

```
Beanstalk/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                  # Vite entry; wires providers + router
    ├── App.jsx                   # Route definitions + auth-aware redirects
    ├── index.css                 # Tailwind directives + component classes
    ├── context/
    │   ├── AuthContext.jsx       # signup / login / logout stub (SHA-256 in-browser)
    │   └── PlannerContext.jsx    # per-user profile, goals, finances persistence
    ├── components/
    │   ├── Layout.jsx            # Top bar + mobile bottom nav shell
    │   └── ProtectedRoute.jsx    # Redirects unauthenticated users
    └── pages/
        ├── Landing.jsx
        ├── Signup.jsx            # Also exports <AuthShell> used by Login
        ├── Login.jsx
        ├── Wizard.jsx            # All 6 steps in one file for readability
        └── Dashboard.jsx         # Home / goals / money / profile views
```

---

## Data & persistence

All data is kept in `localStorage`:

| Key                 | Shape                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `beanstalk.users`   | Array of `{ id, email, username, passwordHash, createdAt }`        |
| `beanstalk.session` | The currently signed-in user's `{ id, email, username }`           |
| `beanstalk.profiles`| Map of `userId → profile` (personal, goals, priorities, finances)  |

Passwords are run through `crypto.subtle.digest('SHA-256', …)` before storage so they aren't kept in plain text, but this is a **prototype convenience only** — it is not secure against anyone with access to the device. Do not reuse a real password.

To reset everything during development, open devtools and run:

```js
localStorage.clear()
```

---

## Wiring a real backend

The auth and persistence layer is deliberately isolated so you can swap it out without touching UI code:

- `src/context/AuthContext.jsx` — replace `signup`, `login`, `logout` with calls to your API (e.g. Supabase, Firebase, or a Node/Express server). Keep the same `{ user, loading, signup, login, logout }` shape and everything else keeps working.
- `src/context/PlannerContext.jsx` — replace the `readProfiles` / `writeProfiles` reads with `fetch` calls to your profile endpoints keyed by `user.id`.

The rest of the app reads from those two contexts, so no component changes are needed.

---

## Extending the wizard

Each step is a self-contained component inside `src/pages/Wizard.jsx`. To add or reorder steps:

1. Add a new entry to the `STEPS` array at the top.
2. Implement a component following the `Step*` pattern (receives `profile` and update helpers).
3. Render it in the `current.id === '…'` switch near the bottom of `Wizard()`.

Reading the result on the dashboard is equally simple: `profile.<section>` is already persisted.

---

## Roadmap ideas

- Drag-and-drop reordering on priorities (currently uses up/down buttons for touch reliability).
- Chart.js / Recharts sparklines on the money view.
- Account settings page (rename, change password, export data as JSON).
- Real backend + sync across devices.
- Offline-first PWA manifest.
