import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OurPlatformLayout from './components/OurPlatformLayout'
import OurPlatform from './pages/OurPlatform'
import OurPlatformEditor from './pages/OurPlatformEditor'
import OurPlatformExport from './pages/OurPlatformExport'
import AboutUs from './pages/AboutUs'
import PageTransition from './components/PageTransition'

export default function App() {
  return (
    <BrowserRouter>
      <PageTransition>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/aboutus" element={<AboutUs />} />
          <Route path="/ourplatform" element={<OurPlatformLayout />}>
            <Route index element={<OurPlatform />} />
            <Route path="editor" element={<OurPlatformEditor />} />
            <Route path="export" element={<OurPlatformExport />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </BrowserRouter>
  )
}
