import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const DEFAULT_PREFERENCES = {
  export_include_line_numbers: true,
  export_include_page_numbers: true,
  auto_advance_on_accept: false,
}

function normalizePreferences(row) {
  if (!row) return { ...DEFAULT_PREFERENCES }
  return {
    export_include_line_numbers: row.export_include_line_numbers !== false,
    export_include_page_numbers: row.export_include_page_numbers !== false,
    auto_advance_on_accept: row.auto_advance_on_accept === true,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('signin')
  const [tokenBalance, setTokenBalance] = useState(null)
  const [userPlan, setUserPlan] = useState(null)
  const [planRenewsAt, setPlanRenewsAt] = useState(null)
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [preferencesLoading, setPreferencesLoading] = useState(false)

  const fetchTokenBalance = useCallback(async (uid) => {
    if (!uid) {
      setTokenBalance(null)
      setUserPlan(null)
      setPlanRenewsAt(null)
      setPreferences(DEFAULT_PREFERENCES)
      setPreferencesLoading(false)
      return
    }
    setPreferencesLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select(
        'balance, plan, plan_renews_at, export_include_line_numbers, export_include_page_numbers, auto_advance_on_accept',
      )
      .eq('user_id', uid)
      .single()
    setTokenBalance(data?.balance ?? 0)
    setUserPlan(data?.plan ?? null)
    setPlanRenewsAt(data?.plan_renews_at ?? null)
    setPreferences(normalizePreferences(data))
    setPreferencesLoading(false)
  }, [])

  const updatePreferences = useCallback(async (patch) => {
    const { data, error } = await supabase.rpc('update_user_preferences', {
      p_export_include_line_numbers:
        patch.export_include_line_numbers === undefined
          ? null
          : patch.export_include_line_numbers,
      p_export_include_page_numbers:
        patch.export_include_page_numbers === undefined
          ? null
          : patch.export_include_page_numbers,
      p_auto_advance_on_accept:
        patch.auto_advance_on_accept === undefined ? null : patch.auto_advance_on_accept,
    })
    if (error) throw error
    const next = normalizePreferences(data)
    setPreferences(next)
    return next
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

  // Returns tokens charged on a case — e.g. when an upload errors out before
  // handoff. Case-scoped so callers cannot mint an arbitrary amount.
  const refundTokens = useCallback(async (caseId, description = null) => {
    if (!user || !caseId) return false
    const { data, error } = await supabase.rpc('refund_case_tokens', {
      p_case_id: caseId,
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
        setPreferences(DEFAULT_PREFERENCES)
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
    setPreferences(DEFAULT_PREFERENCES)
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
      preferences,
      preferencesLoading,
      updatePreferences,
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
