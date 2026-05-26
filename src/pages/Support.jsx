import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const categories = [
  { value: 'general', label: 'General Question' },
  { value: 'billing', label: 'Billing & Plans' },
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
    q: 'How long does AI review take?',
    a: 'Most transcripts are fully reviewed within 2–5 minutes depending on length. The AI runs entirely in the cloud — no software installation required.',
  },
  {
    q: 'Is my transcript data secure?',
    a: 'Yes. All files are encrypted at rest and in transit. Case files are automatically and permanently purged after 90 days. Only you can access your case files.',
  },
  {
    q: 'Can I export to court-specific formats?',
    a: 'Court Reportcard currently supports .txt, .rtf, and .json exports. PDF, Word, and additional formats are coming soon.',
  },
]

export default function Support() {
  const { isAuthenticated } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', category: 'general', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)

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
              <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">support_agent</span>
              We're here to help
            </span>
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-on-surface-variant hover:text-primary transition-colors shrink-0">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="hidden sm:inline">{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
          <h1 className="font-headline font-extrabold text-3xl sm:text-5xl text-on-surface tracking-tight mb-3">
            Contact Support
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-xl">
            Send us a message and we'll get back to you within one business day. For urgent issues, include as much detail as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-12">

          {/* Left — contact form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 editorial-shadow border border-outline-variant/10 text-center">
                <span className="material-symbols-outlined text-5xl text-green-500 block mb-4">mark_email_read</span>
                <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Message sent!</h2>
                <p className="text-on-surface-variant text-sm mb-6">
                  We'll get back to you within one business day.
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
                  <select
                    value={form.category}
                    onChange={set('category')}
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
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

              </form>
            )}
          </div>

          {/* Right — contact info + FAQ */}
          <div className="space-y-6">

            {/* Contact cards */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 editorial-shadow border border-outline-variant/10 space-y-5">
              <h3 className="font-headline font-bold text-base text-on-surface">Get in touch</h3>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">mail</span>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Email</p>
                  <a href="mailto:courtreportcard@gmail.com" className="text-sm text-primary hover:underline">
                    courtreportcard@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">schedule</span>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Response Time</p>
                  <p className="text-sm text-on-surface">Within 1 business day</p>
                </div>
              </div>
            </div>

            {/* FAQ accordion */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 editorial-shadow border border-outline-variant/10">
              <h3 className="font-headline font-bold text-base text-on-surface mb-4">Common Questions</h3>
              <div className="space-y-2">
                {faqs.map((faq, i) => (
                  <div key={i} className="border border-outline-variant/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span>{faq.q}</span>
                      <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0 ml-2 transition-transform duration-200" style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-4 pt-1 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/10">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>


          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
