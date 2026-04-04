import { useState } from 'react'
import { Link } from 'react-router-dom'
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
    a: 'Court Reportcard accepts RTF and CRE transcript files alongside WAV, MP3, and DSS audio files.',
  },
  {
    q: 'How long does AI review take?',
    a: 'Most transcripts are fully reviewed within 2–5 minutes depending on length and audio quality.',
  },
  {
    q: 'Is my transcript data secure?',
    a: 'Yes. All files are end-to-end encrypted in transit and at rest. Only you can access your case files.',
  },
  {
    q: 'Can I export to court-specific formats?',
    a: 'Court Reportcard supports PDF, Word (.docx), plain text, and Catalyst/ASCII export formats, all auto-formatted to Federal and District Court standards.',
  },
]

export default function Support() {
  const [form, setForm] = useState({ name: '', email: '', category: 'general', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    // When a mail backend is connected, fire the API call here.
    // mailto fallback for now so clicking actually opens the user's mail client.
    const body = encodeURIComponent(
      `Name: ${form.name}\nCategory: ${form.category}\n\n${form.message}`
    )
    window.location.href = `mailto:support@courtreportcard.com?subject=${encodeURIComponent(form.subject || 'Support Request')}&body=${body}`
    setSubmitted(true)
  }

  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col">

      <main className="flex-1 px-8 py-14 max-w-[1440px] mx-auto w-full">

        {/* Page header */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">support_agent</span>
            We're here to help
          </span>
          <h1 className="font-headline font-extrabold text-5xl text-on-surface tracking-tight mb-3">
            Contact Support
          </h1>
          <p className="text-lg text-on-surface-variant max-w-xl">
            Send us a message and we'll get back to you within one business day. For urgent issues, include as much detail as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">

          {/* Left — contact form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 editorial-shadow border border-outline-variant/10 text-center">
                <span className="material-symbols-outlined text-5xl text-green-500 block mb-4">mark_email_read</span>
                <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Message sent!</h2>
                <p className="text-on-surface-variant text-sm mb-6">
                  Your email client should have opened. If not, email us directly at{' '}
                  <a href="mailto:support@courtreportcard.com" className="text-primary underline">
                    support@courtreportcard.com
                  </a>
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

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  Send Message
                </button>

                <p className="text-[11px] text-on-surface-variant text-center">
                  Or email us directly at{' '}
                  <a href="mailto:support@courtreportcard.com" className="text-primary underline">
                    support@courtreportcard.com
                  </a>
                </p>

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
                  <a href="mailto:support@courtreportcard.com" className="text-sm text-primary hover:underline">
                    support@courtreportcard.com
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
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">location_on</span>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Hours</p>
                  <p className="text-sm text-on-surface">Mon – Fri, 9 AM – 6 PM ET</p>
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

            {/* Back link */}
            <Link to="/" className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Home
            </Link>

          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
