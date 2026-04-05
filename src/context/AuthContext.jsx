import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('signin')
  const [tokenBalance, setTokenBalance] = useState(null)

  const fetchTokenBalance = useCallback(async (uid) => {
    if (!uid) { setTokenBalance(null); return }
    const { data } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', uid)
      .single()
    setTokenBalance(data?.balance ?? 0)
  }, [])

  const spendToken = useCallback(async () => {
    if (!user || tokenBalance === null || tokenBalance <= 0) return false
    const { error } = await supabase
      .from('user_tokens')
      .update({ balance: tokenBalance - 1, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return false
    setTokenBalance((b) => b - 1)
    return true
  }, [user, tokenBalance])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) fetchTokenBalance(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setModalOpen(false)
        fetchTokenBalance(session.user.id)
      } else {
        setTokenBalance(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAuthenticated = !!user

  const displayName = user?.user_metadata?.first_name && user?.user_metadata?.last_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User'

  const initials = user?.user_metadata?.first_name && user?.user_metadata?.last_name
    ? `${user.user_metadata.first_name.charAt(0)}${user.user_metadata.last_name.charAt(0)}`.toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U'

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email, password, metadata = {}) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setTokenBalance(null)
  }

  const openModal = (tab = 'signin') => { setModalTab(tab); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      loading,
      displayName,
      initials,
      tokenBalance,
      spendToken,
      refreshTokens: () => user && fetchTokenBalance(user.id),
      signIn,
      signUp,
      signOut,
      modalOpen,
      modalTab,
      openModal,
      closeModal,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
