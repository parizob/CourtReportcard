import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OurPlatform from './pages/OurPlatform'
import AboutUs from './pages/AboutUs'
import TermsOfService from './pages/TermsOfService'
import Privacy from './pages/Privacy'
import Support from './pages/Support'
import Pricing from './pages/Pricing'
import PageTransition from './components/PageTransition'
import SiteHeader from './components/SiteHeader'
import SignInModal from './components/SignInModal'
import ScrollToTop from './components/ScrollToTop'
import TelemetryTracker from './components/TelemetryTracker'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/dashboard/Dashboard'
import DashboardUpload from './pages/dashboard/DashboardUpload'
import DashboardEditor from './pages/dashboard/DashboardEditor'
import DashboardExport from './pages/dashboard/DashboardExport'
import DashboardAccount from './pages/dashboard/DashboardAccount'
import DashboardBilling from './pages/dashboard/DashboardBilling'
import ResetPassword from './pages/ResetPassword'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppShell() {
  const { modalOpen, modalTab, closeModal } = useAuth()
  return (
    <>
      <ScrollToTop />
      <TelemetryTracker />
      <SiteHeader />
      <PageTransition>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/aboutus" element={<AboutUs />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/support" element={<Support />} />
          <Route path="/ourplatform" element={<OurPlatform />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<DashboardUpload />} />
            <Route path="editor" element={<DashboardEditor />} />
            <Route path="export" element={<DashboardExport />} />
            <Route path="account" element={<DashboardAccount />} />
            <Route path="billing" element={<DashboardBilling />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
      {modalOpen && <SignInModal initialTab={modalTab} onClose={closeModal} />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Completely isolated — no header, no nav, no modal */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
