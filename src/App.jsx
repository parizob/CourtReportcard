import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OurPlatformLayout from './components/OurPlatformLayout'
import OurPlatform from './pages/OurPlatform'
import OurPlatformEditor from './pages/OurPlatformEditor'
import OurPlatformExport from './pages/OurPlatformExport'
import AboutUs from './pages/AboutUs'
import Support from './pages/Support'
import PageTransition from './components/PageTransition'
import SiteHeader from './components/SiteHeader'
import SignInModal from './components/SignInModal'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/dashboard/Dashboard'
import DashboardUpload from './pages/dashboard/DashboardUpload'
import DashboardEditor from './pages/dashboard/DashboardEditor'
import DashboardExport from './pages/dashboard/DashboardExport'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppShell() {
  const { modalOpen, modalTab, closeModal } = useAuth()
  return (
    <>
      <ScrollToTop />
      <SiteHeader />
      <PageTransition>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/aboutus" element={<AboutUs />} />
          <Route path="/support" element={<Support />} />
          <Route path="/ourplatform" element={<OurPlatformLayout />}>
            <Route index element={<OurPlatform />} />
            <Route path="editor" element={<OurPlatformEditor />} />
            <Route path="export" element={<OurPlatformExport />} />
          </Route>
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
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}
