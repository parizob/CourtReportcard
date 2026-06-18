import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('signin')
  const [tokenBalance, setTokenBalance] = useState(null)
  const [userPlan, setUserPlan] = useState(null)
  const [planRenewsAt, setPlanRenewsAt] = useState(null)

  const fetchTokenBalance = useCallback(async (uid) => {
    if (!uid) { setTokenBalance(null); setUserPlan(null); setPlanRenewsAt(null); return }
    const { data } = await supabase
      .from('user_profiles')
      .select('balance, plan, plan_renews_at')
      .eq('user_id', uid)
      .single()
    setTokenBalance(data?.balance ?? 0)
    setUserPlan(data?.plan ?? null)
    setPlanRenewsAt(data?.plan_renews_at ?? null)
  }, [])

  // Balance is mutated only through SECURITY DEFINER RPCs — the client has no
  // direct write access to user_profiles.balance. The DB enforces the balance
  // check atomically and writes the ledger row in the same transaction.
  const spendTokens = useCallback(async (amount = 1) => {
    if (!user || amount <= 0) return false
    const { data, error } = await supabase.rpc('spend_tokens', { p_amount: amount })
    // data is the new balance, or null on insufficient funds / no profile.
    if (error || data === null || data === undefined) return false
    setTokenBalance(data)
    return true
  }, [user])

  // Returns tokens to the user — e.g. when an upload errors out before it
  // finishes, so a failed analysis never costs credits.
  const refundTokens = useCallback(async (amount = 1, description = null) => {
    if (!user || amount <= 0) return false
    const { data, error } = await supabase.rpc('refund_tokens', {
      p_amount: amount,
      p_description: description,
    })
    if (error || data === null || data === undefined) {
      console.error('Refund failed:', error?.message || 'no balance returned')
      return false
    }
    setTokenBalance(data)
    return true
  }, [user])

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
        setUserPlan(null)
        setPlanRenewsAt(null)
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
    setUserPlan(null)
    setPlanRenewsAt(null)
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
      userPlan,
      planRenewsAt,
      spendTokens,
      refundTokens,
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
