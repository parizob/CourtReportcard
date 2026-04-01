import { useLocation } from 'react-router-dom'

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  // Key on the top-level section so /ourplatform sub-routes don't re-trigger this animation
  // (the Outlet inside OurPlatformLayout handles its own sub-route animation)
  const section = '/' + (pathname.split('/')[1] || '')
  return (
    <div key={section} className="page-rise">
      {children}
    </div>
  )
}
