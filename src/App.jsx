import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { usePlanner } from './context/PlannerContext.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Wizard from './pages/Wizard.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  const { user } = useAuth()
  const { profile } = usePlanner()

  return (
    <Routes>
      <Route
        path="/"
        element={
          user
            ? <Navigate to={profile?.completedWizard ? '/dashboard' : '/wizard'} replace />
            : <Landing />
        }
      />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/wizard" replace /> : <Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/wizard" element={<Wizard />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
