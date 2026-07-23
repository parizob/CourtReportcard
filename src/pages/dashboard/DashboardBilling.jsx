import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TOKEN_PACKS } from '../../lib/tokenPacks'

// Coin-pile illustration above each token pack — size grows per tier so the
// three cards visually read as "small → medium → large" at a glance.
const PILE_IMAGES = ['/coin-pile-small.png', '/coin-pile-medium.png', '/coin-pile-large.png']

const PURCHASE_PAGE_SIZE = 5

const tiers = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$25',
    period: '/mo',
    tokens: 500,
    features: ['500 tokens/mo (500 pages)', 'Proofreading', 'Basic export (TXT)', 'Email support'],
    cta: 'Coming Soon',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$49',
    period: '/mo',
    tokens: 2000,
    features: ['2,000 tokens/mo (2,000 pages)', 'Priority analysis', 'TXT & JSON exports', 'Priority support'],
    cta: 'Coming Soon',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tokens: null,
    features: ['Custom token volume', 'Team collaboration', 'TXT & JSON exports', 'Dedicated account manager', 'Custom integrations'],
    cta: 'Coming Soon',
  },
]

export default function DashboardBilling() {
  const { user, tokenBalance, userPlan, refreshTokens } = useAuth()
  const tokenCount = tokenBalance ?? 0

  // Real purchasing is gated to a single test account while we validate the
  // Stripe sandbox flow — everyone else still sees the beta placeholder below.
  const testEmail = import.meta.env.VITE_BILLING_TEST_USER_EMAIL
  const canPurchase = Boolean(testEmail && user?.email && user.email.toLowerCase() === testEmail.toLowerCase())

  const [purchasingId, setPurchasingId] = useState(null)
  const [purchaseError, setPurchaseError] = useState(null)
  const [checkoutBanner, setCheckoutBanner] = useState(null) // 'success' | 'canceled'
  const [bannerExiting, setBannerExiting] = useState(false)
  const [purchases, setPurchases] = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [purchasePage, setPurchasePage] = useState(0)
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoMessage, setPromoMessage] = useState(null) // { tone: 'ok' | 'err', text }

  const loadPurchases = async () => {
    // Purchases + admin top-ups (Bonus) + promo redemptions.
    const { data, error } = await supabase
      .from('token_ledger')
      .select('id, amount, description, created_at, price_cents, type')
      .in('type', ['purchase', 'credit', 'promo'])
      .order('created_at', { ascending: false })
    if (!error) {
      const rows = (data ?? []).filter(
        (row) =>
          row.type === 'purchase' ||
          row.type === 'promo' ||
          row.description === 'Admin grant',
      )
      setPurchases(rows)
      setPurchasePage(0)
    }
    setPurchasesLoading(false)
  }

  const historyLabel = (row) => {
    if (row.description === 'Admin grant') return 'Bonus'
    if (row.type === 'promo') return row.description || 'Promo'
    return row.description || 'Purchase'
  }

  const promoErrorMessage = (code) => {
    switch (code) {
      case 'invalid_code':
        return 'That code is not valid.'
      case 'inactive':
        return 'That code is not active yet.'
      case 'expired':
        return 'That code has expired.'
      case 'already_redeemed':
        return 'You already redeemed this code.'
      case 'exhausted':
        return 'This code has reached its redemption limit.'
      case 'not_authenticated':
        return 'Please sign in to redeem a code.'
      default:
        return 'Could not redeem that code. Please try again.'
    }
  }

  const handleRedeemPromo = async (e) => {
    e.preventDefault()
    const trimmed = promoCode.trim()
    if (!trimmed || promoBusy) return

    setPromoBusy(true)
    setPromoMessage(null)
    try {
      const { data, error } = await supabase.rpc('redeem_promo', { p_code: trimmed })
      if (error) {
        setPromoMessage({ tone: 'err', text: promoErrorMessage('unknown') })
        return
      }
      if (!data?.ok) {
        setPromoMessage({ tone: 'err', text: promoErrorMessage(data?.error) })
        return
      }
      setPromoCode('')
      setPromoMessage({
        tone: 'ok',
        text: `${Number(data.tokens).toLocaleString()} tokens added to your balance.`,
      })
      await refreshTokens()
      await loadPurchases()
    } catch {
      setPromoMessage({ tone: 'err', text: promoErrorMessage('unknown') })
    } finally {
      setPromoBusy(false)
    }
  }

  const purchasePageCount = Math.max(1, Math.ceil(purchases.length / PURCHASE_PAGE_SIZE))
  const purchasePageRows = purchases.slice(
    purchasePage * PURCHASE_PAGE_SIZE,
    purchasePage * PURCHASE_PAGE_SIZE + PURCHASE_PAGE_SIZE,
  )

  useEffect(() => {
    if (!user) return
    loadPurchases()
  }, [user?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return

    setCheckoutBanner(checkout)
    params.delete('checkout')
    const newSearch = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''))

    if (checkout !== 'success') return
    // The webhook fulfills the purchase asynchronously and can lag a couple
    // seconds behind this redirect — re-poll instead of a single refresh so
    // the balance / history shown here don't look stale right after paying.
    refreshTokens()
    loadPurchases()
    const timers = [
      setTimeout(() => { refreshTokens(); loadPurchases() }, 2000),
      setTimeout(() => { refreshTokens(); loadPurchases() }, 5000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (!checkoutBanner) return
    setBannerExiting(false)
    // Hold visible, then fade/collapse, then unmount so content below slides up.
    const exitTimer = setTimeout(() => setBannerExiting(true), 5000)
    const removeTimer = setTimeout(() => {
      setCheckoutBanner(null)
      setBannerExiting(false)
    }, 5340)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [checkoutBanner])

  const handleBuy = async (pack) => {
    setPurchaseError(null)
    setPurchasingId(pack.id)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { pack_id: pack.id, origin: window.location.origin },
      })
      if (error || !data?.url) throw new Error(error?.message || 'Could not start checkout.')
      window.location.href = data.url
    } catch (err) {
      setPurchaseError(err.message || 'Something went wrong. Please try again.')
      setPurchasingId(null)
    }
  }

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-5xl mx-auto">

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">payments</span>
            Billing
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Tokens &amp; Billing
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
          Purchase transcript tokens — no subscription required.
          </p>
        </header>

        {/* ─── Checkout return banner ─── */}
        {checkoutBanner && (
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
              bannerExiting ? 'grid-rows-[0fr] opacity-0 mb-0' : 'grid-rows-[1fr] opacity-100 mb-8'
            }`}
          >
            <div className="overflow-hidden min-h-0">
              {checkoutBanner === 'success' ? (
                <section className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
                  <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">check_circle</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">Payment successful.</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      Your tokens are on their way to your balance below. It can take a few seconds to update.
                    </p>
                  </div>
                </section>
              ) : (
                <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 flex items-start gap-4">
                  <span className="material-symbols-outlined text-on-surface-variant text-2xl shrink-0 mt-0.5">info</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">Checkout canceled.</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      No charge was made. You can start a new purchase any time below.
                    </p>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ─── Beta notice ─── */}
        {!canPurchase && (
          <section className="bg-tertiary-fixed/30 border border-tertiary-fixed-dim/40 rounded-2xl p-5 mb-8 flex items-start gap-4">
            <span className="material-symbols-outlined text-tertiary-fixed-dim text-2xl shrink-0 mt-0.5">info</span>
            <div>
              <p className="text-sm font-bold text-on-surface mb-1">We're in beta — no purchasing required right now.</p>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                While we're in beta, there's no option to purchase tokens. But if you're running low, we're happy to load your account with more tokens for free to help you keep testing.{' '}
                <a href="mailto:courtreportcard@gmail.com" className="text-primary font-semibold hover:underline">Email us</a>
                {' '}or{' '}
                <a href="/support" className="text-primary font-semibold hover:underline">submit a support ticket</a>
                {' '}and we'll top you up right away.
              </p>
            </div>
          </section>
        )}

        {/* ─── Balance + promo code ─── */}
        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 sm:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-tertiary-container text-2xl">toll</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your Balance</p>
                <p className="text-2xl font-extrabold text-on-surface">{tokenCount.toLocaleString()} <span className="text-sm font-bold text-on-surface-variant">tokens</span></p>
              </div>
            </div>

            <div className="hidden lg:block w-px self-stretch bg-outline-variant/20 shrink-0" aria-hidden="true" />

            <div className="w-full lg:w-[22rem] shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Promo code</p>
              <form onSubmit={handleRedeemPromo} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={promoBusy}
                  className="flex-1 min-w-0 bg-surface-container rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-bold tracking-wider text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={promoBusy || !promoCode.trim()}
                  data-track-id="billing_redeem_promo"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
                >
                  {promoBusy ? 'Redeeming…' : 'Redeem'}
                </button>
              </form>
              {promoMessage && (
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    promoMessage.tone === 'ok' ? 'text-primary font-semibold' : 'text-error'
                  }`}
                >
                  {promoMessage.text}
                </p>
              )}
            </div>
          </div>
        </section>

        {canPurchase ? (
          /* ─── Token Packs (sandbox — Stripe test mode) ─── */
          <section className="mb-10">
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-tertiary-container text-2xl">token</span>
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold text-on-surface mb-1">
                    Transcript Tokens
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Buy in bulk to save more per token.
                  </p>
                </div>
              </div>

              {purchaseError && (
                <p className="text-sm text-red-600 mb-4">{purchaseError}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TOKEN_PACKS.map((pack, idx) => {
                  const pileImage = PILE_IMAGES[idx] ?? PILE_IMAGES[PILE_IMAGES.length - 1]
                  const isPopular = idx === 1
                  return (
                  <div
                    key={pack.id}
                    className={`relative rounded-xl border p-5 text-center ${
                      isPopular ? 'border-primary/30 bg-primary/[0.03]' : 'border-outline-variant/20 bg-surface-container/30'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <img src={pileImage} alt="" aria-hidden="true" className="h-14 w-auto mx-auto mb-3" />
                    <p className="text-3xl font-extrabold text-on-surface">{pack.tokens.toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-3">tokens</p>
                    <p className="text-lg font-bold text-on-surface mb-3">${pack.priceUsd}</p>
                    <button
                      onClick={() => handleBuy(pack)}
                      disabled={purchasingId !== null}
                      className="w-full bg-primary text-on-primary py-2 rounded-lg font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      {purchasingId === pack.id ? 'Redirecting…' : 'Buy'}
                    </button>
                  </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          /* ─── Beta Notice ─── */
          <section className="mb-10">
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">construction</span>
              </div>
              <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                Beta
              </span>
              <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Billing is on its way</h2>
              <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                Court Reportcard is currently in beta. Subscription plans, token purchases, and payment management
                will be available when we launch publicly.
              </p>
              <p className="text-xs text-on-surface-variant/60 mt-4">
                Your token balance above reflects any tokens granted during the beta period.
              </p>
            </div>
          </section>
        )}

        {/* ─── History: purchases + admin bonuses (token_ledger) ─── */}
        <section className="mb-10">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            History
          </h2>
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3 sm:gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex-1">Date</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant w-24 sm:w-36">Description</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant w-16 sm:w-20 text-right">Tokens</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant w-16 sm:w-20 text-right">Amount</span>
            </div>
            {purchasesLoading ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-on-surface-variant">Loading…</p>
              </div>
            ) : purchases.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl mb-2 block">receipt</span>
                <p className="text-sm text-on-surface-variant">No history yet.</p>
              </div>
            ) : (
              <>
                <ul>
                  {purchasePageRows.map((row) => (
                    <li
                      key={row.id}
                      className="px-6 py-4 border-b border-outline-variant/10 last:border-b-0 flex items-center gap-3 sm:gap-4"
                    >
                      <span className="text-sm text-on-surface flex-1">
                        {new Date(row.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-sm text-on-surface-variant w-24 sm:w-36 truncate">
                        {historyLabel(row)}
                      </span>
                      <span className="text-sm font-bold text-on-surface w-16 sm:w-20 text-right">
                        +{row.amount.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-on-surface w-16 sm:w-20 text-right">
                        {row.price_cents != null ? `$${(row.price_cents / 100).toFixed(2)}` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {purchases.length > PURCHASE_PAGE_SIZE && (
                  <div className="px-6 py-3 border-t border-outline-variant/10 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPurchasePage((p) => Math.max(0, p - 1))}
                      disabled={purchasePage === 0}
                      className="text-xs font-bold text-primary hover:underline disabled:text-on-surface-variant/40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-on-surface-variant">
                      Page {purchasePage + 1} of {purchasePageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPurchasePage((p) => Math.min(purchasePageCount - 1, p + 1))}
                      disabled={purchasePage >= purchasePageCount - 1}
                      className="text-xs font-bold text-primary hover:underline disabled:text-on-surface-variant/40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/*
        ─── HIDDEN UNTIL LAUNCH ─── Subscription Plans, Token Packs, Payment Method, Billing History ───

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-headline text-xl font-bold text-on-surface">Subscription Plans</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {tiers.map((tier) => {
              const isCurrent = userPlan === tier.id
              return (
              <div
                key={tier.name}
                className={`bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex flex-col ${
                  isCurrent ? 'ring-2 ring-primary/30' : ''
                }`}
              >
                {isCurrent && (
                  <span className="self-start bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                    Current
                  </span>
                )}
                <h3 className="font-headline text-lg font-bold text-on-surface">{tier.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-extrabold text-on-surface">{tier.price}</span>
                  {tier.period && <span className="text-sm text-on-surface-variant">{tier.period}</span>}
                </div>
                <p className="text-xs text-on-surface-variant mb-4">
                  {tier.tokens !== null ? `${tier.tokens.toLocaleString()} tokens/mo` : 'Custom token volume'}
                </p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-green-500 text-sm mt-0.5 shrink-0">check</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={!isCurrent}
                  className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${
                    isCurrent
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'bg-surface-container text-on-surface-variant/60 cursor-not-allowed'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : tier.cta}
                </button>
              </div>
              )
            })}
          </div>
        </section>

        <section className="mb-10">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-tertiary-container text-2xl">token</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-1">Transcript Tokens</h3>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Need more pages without committing to a plan? Purchase tokens individually.
                    <span className="font-semibold text-on-surface"> 1 token = 1 transcript page.</span>
                  </p>
                </div>
              </div>
              <button
                disabled
                className="bg-surface-container text-on-surface-variant/60 px-6 py-2.5 rounded-lg font-bold text-sm cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                Buy Tokens — Coming Soon
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {tokenPacks.map((pack) => (
                <div
                  key={pack.amount}
                  className={`relative rounded-xl border p-5 text-center ${
                    pack.popular
                      ? 'border-primary/30 bg-primary/[0.03]'
                      : 'border-outline-variant/20 bg-surface-container/30'
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      Best Value
                    </span>
                  )}
                  <p className="text-3xl font-extrabold text-on-surface">{pack.amount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-2">tokens</p>
                  <p className="text-lg font-bold text-on-surface">{pack.price}</p>
                  <p className="text-[10px] text-on-surface-variant">{pack.per}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">credit_card</span>
            Payment Method
          </h2>
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">credit_card_off</span>
            </div>
            <p className="text-sm font-semibold text-on-surface mb-1">No payment method on file</p>
            <p className="text-xs text-on-surface-variant mb-5 max-w-sm">
              Add a credit card or debit card to purchase tokens and upgrade your plan. Billing setup is coming soon.
            </p>
            <button
              disabled
              className="bg-surface-container text-on-surface-variant/60 px-6 py-2.5 rounded-lg font-bold text-sm cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_card</span>
              Add Payment Method — Coming Soon
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Billing History
          </h2>
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex-1">Date</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant w-40">Description</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant w-24 text-right">Amount</span>
            </div>
            <div className="px-6 py-10 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl mb-2 block">receipt</span>
              <p className="text-sm text-on-surface-variant">No billing history yet.</p>
            </div>
          </div>
        </section>
        */}

      </div>
    </main>
  )
}
