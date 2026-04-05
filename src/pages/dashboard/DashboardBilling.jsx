import { useAuth } from '../../context/AuthContext'

const tiers = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    tokens: 3,
    features: ['3 transcript uploads', 'AI proofreading', 'Basic export (TXT)', 'Email support'],
    cta: 'Current Plan',
    active: true,
  },
  {
    name: 'Professional',
    price: '$49',
    period: '/mo',
    tokens: 25,
    features: ['25 transcript uploads/mo', 'Priority AI analysis', 'All export formats', 'Audio cross-reference', 'Priority support'],
    cta: 'Coming Soon',
    active: false,
  },
  {
    name: 'Firm',
    price: '$149',
    period: '/mo',
    tokens: 100,
    features: ['100 transcript uploads/mo', 'Team collaboration', 'All export formats', 'Audio cross-reference', 'Dedicated account manager', 'Custom integrations'],
    cta: 'Coming Soon',
    active: false,
  },
]

const tokenPacks = [
  { amount: 5, price: '$9.99', per: '$2.00/each' },
  { amount: 15, price: '$24.99', per: '$1.67/each', popular: true },
  { amount: 50, price: '$69.99', per: '$1.40/each' },
]

export default function DashboardBilling() {
  const { tokenBalance } = useAuth()
  const tokenCount = tokenBalance ?? 0

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-5xl mx-auto">

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">payments</span>
            Billing
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Plans &amp; Billing
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            Choose a subscription plan or purchase upload tokens individually.
          </p>
        </header>

        {/* ─── Current Balance ─── */}
        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-on-tertiary-container text-2xl">toll</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your Balance</p>
              <p className="text-2xl font-extrabold text-on-surface">{tokenCount} <span className="text-sm font-bold text-on-surface-variant">tokens</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-on-surface-variant">Plan</p>
            <p className="text-sm font-bold text-primary">Starter (Free)</p>
          </div>
        </section>

        {/* ─── Subscription Plans ─── */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-headline text-xl font-bold text-on-surface">Subscription Plans</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex flex-col ${
                  tier.active ? 'ring-2 ring-primary/30' : ''
                }`}
              >
                {tier.active && (
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
                  {tier.tokens} upload token{tier.tokens !== 1 ? 's' : ''} included
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
                  disabled={!tier.active}
                  className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${
                    tier.active
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'bg-surface-container text-on-surface-variant/60 cursor-not-allowed'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Token Packs ─── */}
        <section className="mb-10">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-tertiary-container text-2xl">token</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-1">Upload Tokens</h3>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Need more uploads without committing to a plan? Purchase tokens individually.
                    <span className="font-semibold text-on-surface"> 1 token = 1 transcript upload.</span>
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

        {/* ─── Payment Method ─── */}
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

        {/* ─── Billing History ─── */}
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

      </div>
    </main>
  )
}
