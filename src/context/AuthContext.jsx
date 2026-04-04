import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('signin')

  const login = () => { setIsAuthenticated(true); setModalOpen(false) }
  const logout = () => setIsAuthenticated(false)
  const openModal = (tab = 'signin') => { setModalTab(tab); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, modalOpen, modalTab, openModal, closeModal }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
