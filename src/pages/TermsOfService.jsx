import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'

const sections = [
  {
    num: '1.',
    title: 'Beta Service — Provided As-Is',
    body: `Court Reportcard is currently offered as a free, pre-release beta product. The Service is experimental, under active development, and provided strictly "AS-IS" and "AS-AVAILABLE" without warranty of any kind — express, implied, or statutory. This includes, without limitation, any implied warranties of merchantability, fitness for a particular purpose, accuracy, reliability, or non-infringement. Features may change, be removed, or be unavailable without notice. Your use of the Service during this beta period is entirely at your own risk.`,
  },
  {
    num: '2.',
    title: 'Acceptance of Terms & Professional Responsibility',
    body: `By accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms. The Service is an artificial intelligence-assisted proofreading tool designed to assist — not replace — professional human review. You maintain sole and complete responsibility for the accuracy, legality, completeness, and formatting of any transcript or document exported from the Service. The Service does not constitute legal advice. Court Reportcard assumes no liability for errors, omissions, or contextual inaccuracies in any output.`,
  },
  {
    num: '3.',
    title: 'Disclaimer of Warranties',
    body: `To the fullest extent permitted by applicable law, the Service and all content, features, and functionality are provided without any warranty whatsoever. Court Reportcard does not warrant that:`,
    bullets: [
      'The Service will be uninterrupted, timely, secure, or error-free.',
      'Any results obtained from the Service will be accurate, complete, or reliable.',
      'Any errors in the Service will be corrected.',
      'The Service is fit for any particular professional, legal, or commercial purpose.',
    ],
  },
  {
    num: '4.',
    title: 'Limitation of Liability',
    body: `To the maximum extent permitted by applicable law, Court Reportcard and its individual operator shall not be liable for any direct, indirect, incidental, special, consequential, exemplary, or punitive damages of any kind — including but not limited to loss of profits, revenue, data, goodwill, or business — arising out of or related to your use of or inability to use the Service, even if advised of the possibility of such damages. Because the Service is currently offered free of charge, and in recognition that you have paid no fees for access, our total aggregate liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed zero dollars ($0.00). This limitation applies regardless of the legal theory under which the claim is brought.`,
  },
  {
    num: '5.',
    title: 'Indemnification',
    body: `You agree to defend, indemnify, and hold harmless Court Reportcard and its individual operator from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:`,
    bullets: [
      'Your use of or access to the Service.',
      'Your violation of these Terms.',
      'Your violation of any applicable law, rule, or regulation.',
      'Any content or data you upload, transmit, or process through the Service, including any claim that such content infringes or violates any third-party right.',
      'Any upload of Protected Health Information or other regulated data in violation of these Terms.',
    ],
  },
  {
    num: '6.',
    title: 'Strict Prohibition of Protected Health Information (PHI)',
    body: `The Service is currently not HIPAA-compliant. You are strictly prohibited from uploading, processing, or transmitting any documents that contain Protected Health Information (PHI) or any data regulated by the Health Insurance Portability and Accountability Act (HIPAA).`,
    bullets: [
      'By uploading a file to the Service, you affirmatively represent and warrant that the document contains no PHI or other regulated health data.',
      'You agree to fully indemnify and hold harmless Court Reportcard and its operator against any legal action, regulatory fines, or damages resulting from your upload of HIPAA-regulated or otherwise prohibited data.',
    ],
  },
  {
    num: '7.',
    title: 'Data Privacy, AI Processing, and Retention',
    body: `We take the confidentiality of your legal transcripts seriously.`,
    bullets: [
      'No Model Training: Text uploaded to Court Reportcard is processed using enterprise-grade AI APIs. Your uploaded documents, text, and corrections are never used to train, fine-tune, or improve any AI models.',
      'Data Retention: Uploaded files and generated suggestions are temporarily stored on secure, certified cloud infrastructure solely to facilitate your editing session. Files and their associated data will be permanently deleted from our servers upon your manual deletion or automatically after 90 days, whichever occurs first.',
    ],
  },
  {
    num: '8.',
    title: 'Billing, Subscriptions, and Page Credits',
    body: `Where paid features are made available, the Service operates on a "Page Credit" system.`,
    bullets: [
      'Credit Usage: Processing documents consumes Page Credits based on the volume of text uploaded.',
      'Renewals and Expiration: Subscription tiers grant a specific allotment of Page Credits per billing cycle. Unused credits do not roll over to the next billing cycle.',
      'Refunds: Due to the computational costs associated with AI processing, all purchases and subscriptions are non-refundable once credits have been consumed.',
    ],
  },
  {
    num: '9.',
    title: 'Account Security',
    body: `You are responsible for maintaining the confidentiality of your login credentials. Because the Service handles sensitive legal texts, you must notify us immediately at courtreportcard@gmail.com of any unauthorized use of your account. You agree not to share your account access with third parties.`,
  },
  {
    num: '10.',
    title: 'Termination',
    body: `We reserve the right to suspend or terminate your account at any time, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, the operator, or third parties. Upon termination, your right to use the Service ceases immediately.`,
  },
  {
    num: '11.',
    title: 'Dispute Resolution',
    body: `Before filing any formal legal claim, you agree to contact us at courtreportcard@gmail.com and give us thirty (30) days to attempt to resolve the dispute informally. Any claim not resolved informally shall be resolved through binding individual arbitration rather than in court, except that either party may bring an individual claim in small claims court if it qualifies. You waive any right to participate in a class action lawsuit or class-wide arbitration.`,
  },
  {
    num: '12.',
    title: 'Changes to These Terms',
    body: `We may modify these Terms at any time. Material changes will be communicated via email or through the Service. Your continued use of the Service after any modification constitutes your acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Service.`,
  },
]

export default function TermsOfService() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <Helmet>
        <title>Terms of Service | Court Reportcard</title>
        <meta name="description" content="Review Court Reportcard's terms of service, including usage rights, data handling, and the PHI certification agreement required before uploading legal transcripts." />
        <link rel="canonical" href="https://www.courtreportcard.com/terms" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 sm:px-8 py-10 sm:py-16 lg:py-24">

        <div className="mb-8 sm:mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Legal</span>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Court Reportcard</span> &mdash; Last Updated: June 11, 2026
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 mb-8">
          <p className="text-sm text-on-surface leading-relaxed">
            Welcome to Court Reportcard. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Court Reportcard application, website, and services (collectively, the &ldquo;Service&rdquo;). <strong>Court Reportcard is currently a free beta product operated by an individual and is not a registered legal entity.</strong> By creating an account or using the Service in any way, you agree to be bound by these Terms in their entirety. If you do not agree, do not use the Service.
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
