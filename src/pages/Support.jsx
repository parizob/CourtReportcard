import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const categories = [
  { value: 'general', label: 'General Question' },
  { value: 'billing', label: 'Billing & Plans' },
  { value: 'tokens', label: 'Request More Tokens' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'transcript', label: 'Transcript / Upload Problem' },
  { value: 'export', label: 'Export or Formatting Issue' },
  { value: 'feedback', label: 'Product Feedback' },
  { value: 'other', label: 'Other' },
]

const faqs = [
  {
    q: 'What file formats can I upload?',
    a: 'Court Reportcard accepts .txt and .rtf transcript files — the two formats most commonly exported by court reporter CAT software. Support for additional file formats is coming soon.',
  },
  {
    q: 'What does Court Reportcard check?',
    a: 'Court Reportcard reviews every line of testimony for steno errors, homophone substitutions (e.g., "counsel" vs. "council"), missing words, incorrect legal terminology, punctuation issues, and capitalization errors. It also cross-references attorney and party names from the appearances page against the transcript body to flag inconsistent spellings. Party information such as addresses and case numbers should always be manually verified against the original filing.',
  },
  {
    q: 'How long does a review take?',
    a: 'Most transcripts are fully reviewed within 2–5 minutes depending on length. We run entirely in the cloud — no software installation required.',
  },
  {
    q: 'Can I export to court-specific formats?',
    a: 'Court Reportcard currently supports .txt, .rtf, and .json exports. PDF, Word, and additional formats are coming soon.',
  },
  {
    q: 'Is this the right tool for classified or HIPAA-protected transcripts?',
    a: 'Not yet. Court Reportcard is currently in beta and is not HIPAA compliant at this stage. Please do not upload transcripts containing protected health information, classified material, or any content subject to strict regulatory requirements. We take this seriously and will communicate clearly when compliance certification is in place.',
  },
  {
    q: 'How do I know my transcript won\'t be shared or used to train a model?',
    a: 'Your transcript data is yours. We use an enterprise-grade AI API that is contractually prohibited from using your input to train any models — what you send in is never used to improve or build anything on their end. Your files are stored on certified cloud infrastructure that meets SOC 2 and SOX compliance standards — the same tier trusted by thousands of businesses handling sensitive data. We also enforce user-level data isolation, meaning your cases are technically inaccessible to any other user on the platform. No one sees your work but you.',
  },
  {
    q: 'I\'ve run out of tokens. How do I get more?',
    a: (
      <>
        You can buy token packs any time from{' '}
        <a href="/dashboard/billing" className="italic text-primary underline transition-colors">
          Tokens &amp; Billing
        </a>
        {' '}in your dashboard (1 token = 1 page). If something goes wrong with a purchase, submit a support ticket above or email{' '}
        <a href="mailto:courtreportcard@gmail.com" className="italic text-primary underline transition-colors">
          courtreportcard@gmail.com
        </a>
        .
      </>
    ),
  },
]

export default function Support() {
  const { isAuthenticated } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', category: 'general', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)

  const thankYouRef = useRef(null)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setSubmitted(true)
      setTimeout(() => thankYouRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col">
      <Helmet>
        <title>Support & FAQ | Court Reportcard</title>
        <meta name="description" content="Find answers to common questions about Court Reportcard — file formats, token pricing, data security, and how the AI transcript editor works. Contact us for additional help." />
        <link rel="canonical" href="https://www.courtreportcard.com/support" />
      </Helmet>

      <main className="flex-1 px-6 sm:px-8 py-10 sm:py-14 max-w-[1440px] mx-auto w-full">

        {/* Page header */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              We're here to help
            </span>
            <Link
              to={isAuthenticated ? '/dashboard' : '/'}
              className="group inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-on-surface-variant hover:text-primary transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1">arrow_back</span>
              <span className="hidden sm:inline group-hover:underline">{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
              <span className="sm:hidden group-hover:underline">Back</span>
            </Link>
          </div>
          <h1 className="font-headline font-extrabold text-3xl sm:text-5xl text-on-surface tracking-tight mb-3">
            Contact Support
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-xl">
            Send us a message and we'll get back to you within one business day. For urgent issues, include as much detail as possible.
          </p>
        </div>

        <div>

          {/* Contact form — full width */}
          <div>
            {submitted ? (
              <div ref={thankYouRef} className="bg-surface-container-lowest rounded-2xl p-12 editorial-shadow border border-outline-variant/10 text-center">
                <span className="material-symbols-outlined text-5xl text-green-500 block mb-4">mark_email_read</span>
                <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Message sent!</h2>
                <p className="text-on-surface-variant text-sm mb-2">
                  We'll get back to you within one business day.
                </p>
                <p className="text-on-surface-variant text-sm mb-6">
                  In the meantime, you may find an answer in the{' '}
                  <a href="#faqs" className="text-primary font-semibold hover:underline">
                    FAQs below
                  </a>
                  .
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: 'general', subject: '', message: '' }) }}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border border-outline-variant/10 space-y-5">

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Your Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Jane Smith"
                      className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Email Address</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="you@example.com"
                      className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={set('category')}
                      className="w-full bg-surface-container px-4 py-3 pr-10 rounded-lg text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Subject</label>
                  <input
                    required
                    value={form.subject}
                    onChange={set('subject')}
                    placeholder="Brief description of your issue"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={form.message}
                    onChange={set('message')}
                    placeholder="Describe your issue in as much detail as possible. Include transcript names, file types, and any error messages you saw."
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                  />
                </div>

                {sendError && (
                  <div className="p-3 bg-error-container/30 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
                    <span className="material-symbols-outlined text-base shrink-0">error</span>
                    {sendError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">{sending ? 'hourglass_top' : 'send'}</span>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1.5 pt-1 text-xs text-on-surface-variant/50">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">mail</span>
                    Or email us directly at{' '}
                    <a href="mailto:courtreportcard@gmail.com" className="text-primary/70 hover:text-primary hover:underline transition-colors">
                      courtreportcard@gmail.com
                    </a>
                  </span>
                  <span className="hidden sm:inline mx-1">·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    We respond within 1 business day
                  </span>
                </div>

              </form>
            )}
          </div>
        </div>

        {/* FAQ — full width below */}
        <div id="faqs" className="mt-10 sm:mt-14">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Frequently Asked Questions
            </span>
            <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mt-1">
              Common Questions
            </h2>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 editorial-shadow overflow-hidden">
            <div className="grid lg:grid-cols-[280px_1fr]">
              {/* Question list */}
              <div className="border-b lg:border-b-0 lg:border-r border-outline-variant/10 flex lg:flex-col overflow-x-auto lg:overflow-x-visible">
                {faqs.map((faq, i) => (
                  <button
                    key={i}
                    onClick={() => setOpenFaq(i)}
                    className={`text-left px-5 py-4 text-sm font-medium transition-colors shrink-0 lg:shrink border-r lg:border-r-0 lg:border-b border-outline-variant/10 last:border-0 ${
                      openFaq === i
                        ? 'bg-primary/5 text-primary font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {faq.q}
                  </button>
                ))}
              </div>
              {/* Answer panel */}
              <div className="px-8 py-10 min-h-[280px] flex items-center justify-center">
                {openFaq !== null ? (
                  <div key={openFaq} className="faq-reveal w-full">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary/70 mb-3">
                      {faqs[openFaq].q}
                    </p>
                    <div className="text-base text-on-surface leading-relaxed">{faqs[openFaq].a}</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/20 block mb-3">forum</span>
                    <p className="text-base font-semibold text-on-surface/40">Have a question?</p>
                    <p className="text-sm text-on-surface-variant/30 mt-1">Select one from the list to read the answer.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
