import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Materials = lazy(() => import('./pages/Materials'))
const FloorPlan = lazy(() => import('./pages/FloorPlan'))
const Notes = lazy(() => import('./pages/Notes'))
const Inspirations = lazy(() => import('./pages/Inspirations'))
const BudgetPDFs = lazy(() => import('./pages/BudgetPDFs'))
const Settings = lazy(() => import('./pages/Settings'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Calendar = lazy(() => import('./pages/Calendar'))
const ProgressPhotos = lazy(() => import('./pages/ProgressPhotos'))
const HomeInfo = lazy(() => import('./pages/HomeInfo'))
const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Invite = lazy(() => import('./pages/Invite'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function PageLoader() {
  return <div className="flex min-h-[45dvh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" /></div>
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-stone-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-stone-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  if (user) {
    const queryToken = new URLSearchParams(location.search).get('invite')
    const inviteToken = queryToken || localStorage.getItem('nivel_pending_invite')
    return <Navigate to={inviteToken ? `/invite/${inviteToken}` : '/dashboard'} replace />
  }
  return children
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}><Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="vivienda" element={<HomeInfo />} />
        <Route path="materials" element={<Materials />} />
        <Route path="planos" element={<FloorPlan />} />
        <Route path="notas" element={<Notes />} />
        <Route path="inspiracion" element={<Inspirations />} />
        <Route path="presupuestos" element={<BudgetPDFs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="tareas" element={<Tasks />} />
        <Route path="gastos" element={<Expenses />} />
        <Route path="proveedores" element={<Suppliers />} />
        <Route path="calendario" element={<Calendar />} />
        <Route path="progreso" element={<ProgressPhotos />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
  )
}
