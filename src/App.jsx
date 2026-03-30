import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OurPlatformLayout from './components/OurPlatformLayout'
import OurPlatform from './pages/OurPlatform'
import OurPlatformEditor from './pages/OurPlatformEditor'
import OurPlatformExport from './pages/OurPlatformExport'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ourplatform" element={<OurPlatformLayout />}>
          <Route index element={<OurPlatform />} />
          <Route path="editor" element={<OurPlatformEditor />} />
          <Route path="export" element={<OurPlatformExport />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
