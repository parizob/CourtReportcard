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

  const spendTokens = useCallback(async (amount = 1) => {
    if (!user || tokenBalance === null || amount <= 0) return false
    if (tokenBalance < amount) return false
    const newBalance = tokenBalance - amount
    const { error } = await supabase
      .from('user_profiles')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return false
    await supabase.from('token_ledger').insert({
      user_id: user.id,
      amount: -amount,
      type: 'spend',
    })
    setTokenBalance(newBalance)
    return true
  }, [user, tokenBalance])

  // Returns tokens to the user — e.g. when an upload errors out before it
  // finishes, so a failed analysis never costs credits. Re-reads the
  // authoritative balance from the DB so it can't race with stale local state.
  const refundTokens = useCallback(async (amount = 1, description = null) => {
    if (!user || amount <= 0) return false
    const { data, error: readErr } = await supabase
      .from('user_profiles')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    if (readErr) return false
    const newBalance = (data?.balance ?? 0) + amount
    const { error } = await supabase
      .from('user_profiles')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return false
    // Audit entry — best effort; never let a ledger hiccup block the refund.
    const { error: ledgerErr } = await supabase.from('token_ledger').insert({
      user_id: user.id,
      amount,
      type: 'refund',
      description,
    })
    if (ledgerErr) console.error('Refund ledger insert failed:', ledgerErr.message)
    setTokenBalance(newBalance)
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
