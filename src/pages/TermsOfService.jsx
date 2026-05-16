import SiteFooter from '../components/SiteFooter'

const sections = [
  {
    num: '1.',
    title: 'Acceptance of Terms & Professional Responsibility',
    body: `The Service is an artificial intelligence-assisted proofreading and formatting tool designed for court reporters and legal professionals. Court Reportcard is not a replacement for professional human review. You maintain sole responsibility for the accuracy, legality, and formatting of any transcript, errata sheet, or document exported from the Service. Court Reportcard assumes no liability for errors, omissions, or contextual inaccuracies in the final output.`,
  },
  {
    num: '2.',
    title: 'Strict Prohibition of Protected Health Information (PHI)',
    body: `The Service is currently not HIPAA-compliant. You are strictly prohibited from uploading, processing, or transmitting any documents that contain Protected Health Information (PHI) or any data regulated by the Health Insurance Portability and Accountability Act (HIPAA).`,
    bullets: [
      'User Liability: By uploading a file to the Service, you affirmatively warrant that the document contains no PHI.',
      'Indemnification: You agree to fully indemnify and hold harmless Court Reportcard against any legal action, fines, or damages resulting from your upload of HIPAA-regulated data.',
    ],
  },
  {
    num: '3.',
    title: 'Data Privacy, AI Processing, and Retention',
    body: `We take the confidentiality of your legal transcripts seriously.`,
    bullets: [
      'No Model Training: Text uploaded to Court Reportcard is processed using enterprise-grade Artificial Intelligence APIs. Your uploaded documents, text, and corrections are never used to train, fine-tune, or improve foundational AI models.',
      'Data Retention: To limit liability and protect client confidentiality, the Service employs a strict data lifecycle. Uploaded files and generated suggestions are temporarily stored on secure, SOC 2 Type 2 compliant servers solely to facilitate your editing session. Files and their associated data will be permanently deleted from our servers upon your manual deletion or automatically after 14 days, whichever occurs first.',
    ],
  },
  {
    num: '4.',
    title: 'Billing, Subscriptions, and Page Credits',
    body: `The Service operates on a subscription model utilizing a "Page Credit" system.`,
    bullets: [
      'Credit Usage: Processing documents consumes Page Credits based on the volume of text uploaded.',
      'Renewals and Expiration: Subscription tiers grant a specific allotment of Page Credits per billing cycle. Unused credits do not roll over to the next billing cycle.',
      'Refunds: Due to the computational costs associated with processing documents through AI language models, all purchases and subscriptions are non-refundable.',
    ],
  },
  {
    num: '5.',
    title: 'Account Security',
    body: `You are responsible for maintaining the confidentiality of your login credentials. Because the Service handles sensitive legal texts, you must notify us immediately of any unauthorized use of your account. You agree not to share your account access with third parties.`,
  },
  {
    num: '6.',
    title: 'Limitation of Liability',
    body: `To the maximum extent permitted by law, Court Reportcard, its founders, and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of your use of or inability to use the Service. In no event shall our total liability exceed the amount you paid to the Service in the three (3) months preceding the claim.`,
  },
  {
    num: '7.',
    title: 'Termination',
    body: `We reserve the right to suspend or terminate your account at any time, without notice, for conduct that we believe violates these Terms, including but not limited to the upload of prohibited medical data or abuse of the Service infrastructure.`,
  },
  {
    num: '8.',
    title: 'Changes to These Terms',
    body: `We may modify these Terms at any time. If we make material changes, we will notify you via email or through the Service. Your continued use of the Service after such modifications constitutes your acknowledgment and acceptance of the updated Terms.`,
  },
]

export default function TermsOfService() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 sm:px-8 py-10 sm:py-16 lg:py-24">

        <div className="mb-8 sm:mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Legal</span>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Court Reportcard</span> &mdash; Last Updated: May 12, 2026
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 mb-8">
          <p className="text-sm text-on-surface leading-relaxed">
            Welcome to Court Reportcard. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Court Reportcard application, website, and services (collectively, the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to be bound by these Terms.
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
              </div>
              <div className="mt-8 border-b border-outline-variant/10" />
            </section>
          ))}
        </div>

        <div className="mt-12 p-6 bg-surface-container-low rounded-xl border border-outline-variant/15">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Questions about these Terms? Contact us at{' '}
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
