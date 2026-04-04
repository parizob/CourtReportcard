import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, openModal } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-66px)] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-on-surface-variant font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    setTimeout(() => openModal('signin'), 0)
    return <Navigate to="/" replace />
  }

  return children
}
