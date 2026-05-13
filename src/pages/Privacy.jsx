import { Link } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'

const sections = [
  {
    num: '1.',
    title: 'Our Approach to Custody',
    body: `Court Reportcard is your secure, active editing bay — not a storage vault. We hold encrypted files only as long as you need them to do the work. Our role ends where yours ends: once the review is complete, the original record belongs in your control, not on our servers.`,
  },
  {
    num: '2.',
    title: 'Encryption',
    body: `All transcripts and associated files are encrypted at rest using AES-256 and in transit using TLS 1.3. Infrastructure is hosted on SOC 2 Type 2 compliant providers (Supabase on AWS). Encryption keys are managed by the platform and rotated on a defined schedule.`,
  },
  {
    num: '3.',
    title: 'The 90-Day Shred',
    body: `Every uploaded transcript and its AI-generated artifacts are automatically and permanently destroyed 90 days after upload. You may also delete any file manually at any time prior to expiration.`,
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
      'Total AI errors caught',
      'Counts of suggestions accepted, ignored, and resolved',
      'Breakdown of error types (spelling, grammar, contextual, etc.)',
    ],
    afterBullets: `Original transcript content, audio, and AI annotation payloads are unrecoverable. Your dashboard will display purged cases with a "Text Deleted for Security" indicator alongside their preserved metrics.`,
  },
  {
    num: '5.',
    title: 'Access Controls',
    body: `Outside of designated enterprise account managers acting under explicit, audit-logged access requests, no Court Reportcard employee can access your account or your data. Period. All internal access is logged, time-bounded, and subject to review. We will never access your account for routine debugging, marketing analysis, or any other unsolicited purpose.`,
  },
  {
    num: '6.',
    title: 'No Model Training',
    body: `Your transcripts, edits, and AI corrections are never used to train, fine-tune, or improve foundational AI models — ours or any third party's. AI processing is performed via enterprise-grade API contracts that contractually prohibit downstream training on customer data.`,
  },
  {
    num: '7.',
    title: 'Compliance Posture',
    body: `Court Reportcard is not currently HIPAA-compliant. The upload of Protected Health Information (PHI) or any data regulated by HIPAA is strictly prohibited under our Terms of Service. By uploading a file, you affirmatively warrant that the document contains no PHI.`,
  },
  {
    num: '8.',
    title: 'Contact',
    body: `For questions about this policy, data deletion requests, or to report a security concern, contact us at courtreportcard@gmail.com.`,
  },
]

export default function Privacy() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-8 py-16 lg:py-24">

        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Legal</span>
          <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Court Reportcard</span> &mdash; Last Updated: May 12, 2026
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 mb-8">
          <p className="text-sm text-on-surface leading-relaxed">
            This policy describes how Court Reportcard handles the confidential legal materials you upload to the Service. It is written for the practitioner who needs to understand &mdash; precisely &mdash; what we do with their files, how long we keep them, and who can see them. For our broader contractual terms, see the <Link to="/terms" className="text-primary font-semibold hover:underline">Terms of Service</Link>.
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
            <a href="mailto:courtreportcard@gmail.com" className="text-primary hover:underline font-semibold">
              courtreportcard@gmail.com
            </a>
          </p>
        </div>

      </main>
      <SiteFooter />
    </div>
  )
}
