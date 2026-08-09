import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'

const sections = [
  {
    num: '1.',
    title: 'Our Approach to Custody',
    body: `Court Reportcard is your secure, active editing bay, not a storage vault. We hold encrypted files only as long as you need them to do the work. Our role ends where yours ends: once the review is complete, the original record belongs in your control, not on our servers. Our privacy commitments apply to your files while they are stored in Court Reportcard. If you file a transcript with a court or share it with others, that copy is governed by the rules of that court or recipient, which may treat filed materials as public record.`,
  },
  {
    num: '2.',
    title: 'Encryption',
    body: `All transcripts and associated files are encrypted at rest using AES-256 and in transit using TLS 1.3. Infrastructure is hosted on SOC 2 Type 2 compliant cloud providers (including our database and file storage providers). Encryption keys are managed by the platform and rotated on a defined schedule.`,
  },
  {
    num: '3.',
    title: 'The 90-Day Shred',
    body: `Every uploaded transcript and its review artifacts are automatically and permanently destroyed 90 days after upload. You may also delete any file manually at any time prior to expiration.`,
    bullets: [
      'The shred is irreversible. Once destroyed, content cannot be recovered by you, by us, or by court order. We hold no offline backups of your transcript text.',
      'The 90-day clock starts at the moment of upload and runs regardless of activity. The dashboard surfaces the remaining days for every active case so you always know where each file stands.',
    ],
  },
  {
    num: '4.',
    title: 'What We Keep After the Shred',
    body: `The value of historical work is in its outcomes, not in its raw text. After the shred, we retain only anonymized telemetry so your dashboard continues to reflect the work you have completed:`,
    bullets: [
      'Case name and processed date',
      'Total errors flagged',
      'Counts of suggestions accepted, ignored, and resolved',
      'Breakdown of error types (spelling, grammar, contextual, etc.)',
    ],
    afterBullets: `Original transcript content, audio, and annotation payloads are unrecoverable. Your dashboard will display purged cases with a "Text Deleted for Security" indicator alongside their preserved metrics.`,
  },
  {
    num: '5.',
    title: 'Access Controls',
    body: `Each account can only view and manage its own cases and token balance. Other users cannot access your files or account data. Court Reportcard staff do not access your account for marketing or unsolicited review. Limited access may occur to respond to a support request or to diagnose upload and analysis failures so we can fix them. That access is purpose-limited. Your content is never used to train models.`,
  },
  {
    num: '6.',
    title: 'No Model Training',
    body: `Your transcripts, edits, and corrections are never used to train, fine-tune, or improve foundational models, ours or any third party's. Automated processing runs under enterprise API contracts that prohibit downstream training on customer data.`,
  },
  {
    num: '7.',
    title: 'Compliance Posture',
    body: `Court Reportcard is not currently HIPAA-compliant. The upload of Protected Health Information (PHI) or any data regulated by HIPAA is strictly prohibited under our Terms of Service. You are also prohibited from uploading transcripts that are sealed or subject to a sealing or protective order. By uploading a file, you affirmatively warrant that the document contains no PHI and is not subject to a sealing or protective order.`,
  },
  {
    num: '8.',
    title: 'Contact',
    body: `For questions about this policy, data deletion requests, or to report a security concern, contact us at support@courtreportcard.com.`,
  },
]

export default function Privacy() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <Helmet>
        <title>Privacy Policy | Court Reportcard</title>
        <meta name="description" content="Court Reportcard's privacy policy: how we collect, store, and protect your transcript data, including our 90-day automatic file purge policy and encryption practices." />
        <link rel="canonical" href="https://www.courtreportcard.com/privacy" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 sm:px-8 py-10 sm:py-16 lg:py-24">

        <div className="mb-8 sm:mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Legal</span>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Court Reportcard</span> &mdash; Last Updated: May 12, 2026
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 mb-8">
          <p className="text-sm text-on-surface leading-relaxed">
            This policy describes how Court Reportcard handles the confidential legal materials you upload to the Service. It is written for the practitioner who needs to understand &mdash; precisely &mdash; what we do with their files, how long we keep them, and who can see them. For our broader contractual terms, see the <Link to="/terms" className="text-primary font-semibold hover:underline">Terms of Service</Link>. Processing of uploaded transcript content on your behalf is also described in the <Link to="/dpa" className="text-primary font-semibold hover:underline">Data Processing Agreement</Link>.
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.num}>
              <div className="flex gap-3 mb-3">
                <span className="text-primary font-headline font-extrabold text-lg shrink-0">{s.num}</span>
                <h2 className="font-headline font-bold text-lg text-on-surface">{s.title}</h2>
              </div>
              <div className="pl-7 space-y-4">
                <p className="text-sm text-on-surface-variant leading-relaxed">{s.body}</p>
                {s.bullets && (
                  <ul className="space-y-3">
                    {s.bullets.map((b, i) => (
                      <li key={i} className="flex gap-3 text-sm text-on-surface-variant leading-relaxed">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.afterBullets && (
                  <p className="text-sm text-on-surface-variant leading-relaxed">{s.afterBullets}</p>
                )}
              </div>
              <div className="mt-8 border-b border-outline-variant/10" />
            </section>
          ))}
        </div>

        <div className="mt-12 p-6 bg-surface-container-low rounded-xl border border-outline-variant/15">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Questions, deletion requests, or security concerns? Contact us at{' '}
            <a href="mailto:support@courtreportcard.com" className="text-primary hover:underline font-semibold">
              support@courtreportcard.com
            </a>
          </p>
        </div>

      </main>
      <SiteFooter />
    </div>
  )
}
