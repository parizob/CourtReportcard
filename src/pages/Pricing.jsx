import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'
import { TOKEN_PACKS } from '../lib/tokenPacks'

const PILE_IMAGES = ['/coin-pile-small.png', '/coin-pile-medium.png', '/coin-pile-large.png']

const HOW_IT_WORKS = [
  {
    icon: 'toll',
    title: '1 token = 1 page',
    body: 'Every page in your transcript uses one token. A 42-page deposition uses 42 tokens. Simple and predictable.',
  },
  {
    icon: 'upload_file',
    title: 'Counted at upload',
    body: 'When you upload a transcript, we count the pages in that file and charge that many tokens from your balance before processing starts.',
  },
  {
    icon: 'replay',
    title: 'Full refund on failure',
    body: 'If processing fails, those tokens are returned to your account in full.',
  },
]

const DELAY_CLASSES = ['landing-reveal-delay-1', 'landing-reveal-delay-2', 'landing-reveal-delay-3']

export default function Pricing() {
  const { isAuthenticated, openModal } = useAuth()
  const revealRefs = useRef([])

  useEffect(() => {
    const items = revealRefs.current.filter(Boolean)
    if (!items.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const setRevealRef = (index) => (el) => {
    revealRefs.current[index] = el
  }

  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col">
      <Helmet>
        <title>Pricing | Court Reportcard</title>
        <meta
          name="description"
          content="Simple token pricing for Court Reportcard. One token equals one transcript page. Buy packs as you need them, or earn tokens by sharing feedback."
        />
        <link rel="canonical" href="https://www.courtreportcard.com/pricing" />
      </Helmet>

      <main className="flex-1 px-6 sm:px-8 py-10 sm:py-14 max-w-[1440px] mx-auto w-full">
        <div className="mb-10 sm:mb-14 max-w-2xl page-rise">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Pricing
          </span>
          <h1 className="font-headline font-extrabold text-3xl sm:text-5xl text-on-surface tracking-tight mb-4">
            Simple tokens. No subscription required.
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed">
            Pay for the pages you review. One token covers one transcript page, so you always know what a job will cost before you upload.
          </p>
        </div>

        {/* How tokens work */}
        <section className="mb-12 sm:mb-16">
          <h2 ref={setRevealRef(0)} className="landing-reveal font-headline text-xl sm:text-2xl font-bold text-on-surface mb-6">
            How tokens work
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((item, idx) => (
              <div
                key={item.title}
                ref={setRevealRef(1 + idx)}
                className={`landing-reveal ${DELAY_CLASSES[idx]} bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-6 transition-all hover:translate-y-[-2px]`}
              >
                <div className="w-11 h-11 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-tertiary-container text-2xl">{item.icon}</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-2">{item.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Token packs */}
        <section className="mb-12 sm:mb-16">
          <div ref={setRevealRef(4)} className="landing-reveal bg-surface-container-lowest rounded-2xl editorial-shadow p-6 sm:p-8 border border-outline-variant/15">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-tertiary-container text-2xl">token</span>
              </div>
              <div>
                <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface mb-1">
                  Token packs
                </h2>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Buy in bulk to save more per token.
                </p>
                <p className="text-sm text-on-surface-variant italic mt-2 leading-relaxed">
                  1 token = 1 transcript page.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TOKEN_PACKS.map((pack, idx) => {
                const pileImage = PILE_IMAGES[idx] ?? PILE_IMAGES[PILE_IMAGES.length - 1]
                const isPopular = idx === 1
                const perToken = (pack.priceUsd / pack.tokens).toFixed(2)
                return (
                  <div
                    key={pack.id}
                    className={`relative rounded-xl border p-5 text-center transition-all hover:translate-y-[-2px] ${
                      isPopular
                        ? 'border-primary/30 bg-primary/[0.03]'
                        : 'border-outline-variant/20 bg-surface-container/30'
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
                    <p className="text-lg font-bold text-on-surface">${pack.priceUsd}</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">${perToken} per token</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard/billing"
                  data-track-id="pricing_go_billing"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
                >
                  Buy tokens
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal('signup')}
                  data-track-id="pricing_sign_up"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
                >
                  Create an account to buy
                </button>
              )}
              <Link
                to="/support"
                data-track-id="pricing_support_link"
                className="border-2 border-primary/30 text-primary px-6 py-3 rounded-md font-bold text-sm hover:bg-primary/10 hover:border-primary/10 transition-all"
              >
                Questions? Contact support
              </Link>
            </div>
          </div>
        </section>

        {/* Earn tokens via feedback */}
        <section className="mb-8">
          <div ref={setRevealRef(5)} className="landing-reveal bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">rate_review</span>
            </div>
            <div className="flex-1">
              <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface mb-2">
                Earn tokens by sharing feedback
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-3">
                Good or bad, your feedback helps us improve Court Reportcard. When we use something you share on the site (for example a quote) or we ship a fix or enhancement based on your report, we will grant tokens to your account as a thank you.
              </p>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
                Submit a ticket on the Support page and we will follow up with you as soon as we are able.
              </p>
              <Link
                to="/support"
                data-track-id="pricing_submit_feedback"
                className="group inline-flex items-center gap-2 text-sm font-bold text-primary"
              >
                <span className="group-hover:underline">Submit a support ticket</span>
                <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
