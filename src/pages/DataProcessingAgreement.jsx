import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'

const sections = [
  {
    num: '1.',
    title: 'Purpose and Incorporation',
    body: `This Data Processing Agreement ("DPA") forms part of the Terms of Service ("Terms") between you ("Customer," "you," or "Controller") and Court Reportcard / Parizo Labs LLC, doing business as Court Reportcard ("Court Reportcard," "we," "us," "Processor," or "Service Provider"). By creating an account, accessing, or using the Service, you agree to this DPA. If you do not agree, do not use the Service.`,
  },
  {
    num: '2.',
    title: 'Roles of the Parties',
    body: `For Customer Content (defined below), you are the controller (or equivalent) and Court Reportcard is the processor (or service provider) acting on your documented instructions as set out in the Terms, the Privacy Policy, and this DPA. For account data we collect to operate the Service (for example, your email address and token balance), Court Reportcard acts as an independent controller as described in the Privacy Policy.`,
  },
  {
    num: '3.',
    title: 'Customer Content and Scope of Processing',
    body: `Customer Content means transcripts, files, and related text you upload to the Service, together with annotations, suggestions, edits, and export artifacts generated from that material.`,
    bullets: [
      'Subject matter: automated proofreading and related processing of Customer Content to provide the Service.',
      'Duration: for the period Customer Content is retained under the Terms and Privacy Policy (including the 90-day automatic purge and earlier manual deletion).',
      'Nature and purpose: store, transmit, parse, analyze, display, and delete Customer Content solely to provide, maintain, secure, and support the Service.',
      'Types of personal data: may include names, contact details, case identifiers, and other information contained in legal transcripts you choose to upload.',
      'Data subjects: individuals whose information appears in Customer Content (for example, parties, witnesses, attorneys, and court personnel).',
    ],
  },
  {
    num: '4.',
    title: 'Customer Instructions and Responsibilities',
    body: `Court Reportcard will process Customer Content only to provide the Service and as otherwise permitted by the Terms, Privacy Policy, and this DPA, or as required by law.`,
    bullets: [
      'You instruct us to process Customer Content as necessary to operate the upload, analysis, review, export, support, security, and deletion features of the Service.',
      'You are responsible for the lawfulness of Customer Content you upload, including obtaining any consents or authorizations required and ensuring uploads comply with the Terms (including prohibitions on PHI, sealed materials, and protective-order materials).',
      'You must not upload Protected Health Information or other HIPAA-regulated data. This DPA is not a Business Associate Agreement, and Court Reportcard does not act as a HIPAA Business Associate.',
    ],
  },
  {
    num: '5.',
    title: 'Confidentiality',
    body: `We require personnel who may access Customer Content to maintain confidentiality and to access it only as needed to provide or support the Service (for example, diagnosing a failed upload you have asked us to investigate). Access is purpose-limited and is not used for marketing review of your files.`,
  },
  {
    num: '6.',
    title: 'Security Measures',
    body: `We implement technical and organizational measures appropriate to the nature of Customer Content, including:`,
    bullets: [
      'Encryption in transit (TLS) and at rest (AES-256) for stored Customer Content.',
      'Hosting on SOC 2 Type 2 compliant cloud infrastructure for core database and file storage providers.',
      'Account-level isolation so other users cannot access your cases.',
      'Access controls, logging, and operational practices intended to prevent unauthorized access, loss, or alteration.',
    ],
    afterBullets: `No security program can eliminate all risk. You remain responsible for protecting your account credentials and for decisions about what you upload.`,
  },
  {
    num: '7.',
    title: 'Subprocessors',
    body: `You authorize Court Reportcard to engage subprocessors to process Customer Content as needed to provide the Service. Current categories include:`,
    bullets: [
      'Cloud hosting, database, authentication, and file storage providers.',
      'Enterprise AI API providers used to analyze transcript text (under contracts that prohibit using your inputs to train models).',
      'Email delivery providers for transactional notices (for example, analysis complete or failure notices).',
      'Payment processors for token purchases (payment data is handled by the processor; card data is not stored by Court Reportcard as the merchant of record vault).',
      'Application hosting and content delivery for the website and dashboard.',
    ],
    afterBullets: `We remain responsible for subprocessors' performance of obligations under this DPA to the same extent we would be if we performed the services ourselves. We will impose written confidentiality and data-protection obligations on subprocessors that are no less protective than those in this DPA, as applicable to the services they provide.`,
  },
  {
    num: '8.',
    title: 'No Model Training',
    body: `Customer Content is not used to train, fine-tune, or improve foundational models operated by Court Reportcard or our AI API providers. Processing runs under enterprise API arrangements that contractually prohibit training on customer inputs.`,
  },
  {
    num: '9.',
    title: 'Retention and Deletion',
    body: `Customer Content is retained only as described in the Privacy Policy and Terms:`,
    bullets: [
      'You may delete a case and its files manually at any time through the Service (subject to normal processing).',
      'Uploaded files and associated review artifacts are automatically and permanently deleted no later than 90 days after upload.',
      'After deletion, we may retain anonymized metrics that do not include transcript text (for example, counts of issues flagged), as described in the Privacy Policy.',
    ],
  },
  {
    num: '10.',
    title: 'Assistance with Data Subject Requests',
    body: `Because Customer Content is uploaded and controlled by you, you are primarily responsible for responding to requests from individuals about personal data in that content. Taking into account the nature of processing, we will provide reasonable assistance (for example, helping you delete Customer Content from the Service) so you can meet applicable obligations. Requests about your own account data may be directed to courtreportcard@gmail.com.`,
  },
  {
    num: '11.',
    title: 'Personal Data Breach Notification',
    body: `If we become aware of a personal data breach affecting Customer Content, we will notify you without undue delay and provide information reasonably available to us about the nature of the incident and steps taken or recommended. You are responsible for any notifications to individuals or regulators that apply to you as controller.`,
  },
  {
    num: '12.',
    title: 'International Transfers',
    body: `The Service is operated using cloud infrastructure that may process data in the United States. By using the Service, you instruct and authorize such processing as needed to provide the Service. If additional transfer mechanisms become required for your use case, contact us at courtreportcard@gmail.com.`,
  },
  {
    num: '13.',
    title: 'Audits and Information',
    body: `Upon reasonable written request, and no more than once per twelve (12) month period (unless required by a competent regulator or following a personal data breach affecting Customer Content), we will provide information reasonably necessary to demonstrate compliance with this DPA, subject to confidentiality and the security of the Service and other customers.`,
  },
  {
    num: '14.',
    title: 'Return or Deletion at End of Service',
    body: `You may export Customer Content through the Service while it remains available. Upon account closure or deletion of a case, we will delete Customer Content in accordance with Section 9. We are not obligated to retain Customer Content after the retention period ends.`,
  },
  {
    num: '15.',
    title: 'Liability',
    body: `Liability arising out of or related to this DPA is subject to the limitations and exclusions in the Terms, including the Limitation of Liability and Indemnification sections, except to the extent applicable law requires otherwise.`,
  },
  {
    num: '16.',
    title: 'Order of Precedence and Changes',
    body: `If there is a conflict between this DPA and the Terms or Privacy Policy regarding the processing of Customer Content, this DPA controls for that conflict. We may update this DPA as described in the Terms for changes to those Terms. Material changes will be communicated by email or through the Service. Continued use of the Service after an update constitutes acceptance of the updated DPA.`,
  },
  {
    num: '17.',
    title: 'Contact',
    body: `For questions about this DPA or data processing, contact us at courtreportcard@gmail.com.`,
  },
]

export default function DataProcessingAgreement() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <Helmet>
        <title>Data Processing Agreement | Court Reportcard</title>
        <meta name="description" content="Court Reportcard's Data Processing Agreement: how we process transcript data on your behalf, subprocessors, security, retention, and your responsibilities." />
        <link rel="canonical" href="https://www.courtreportcard.com/dpa" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 sm:px-8 py-10 sm:py-16 lg:py-24">

        <div className="mb-8 sm:mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Legal</span>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
            Data Processing Agreement
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Court Reportcard</span> &mdash; Last Updated: August 3, 2026
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 mb-8">
          <p className="text-sm text-on-surface leading-relaxed">
            This Data Processing Agreement describes how Court Reportcard processes transcript files and related content you upload when we provide the Service. It is incorporated into the{' '}
            <Link to="/terms" className="text-primary font-semibold hover:underline">Terms of Service</Link>
            . For how we handle privacy more broadly, see the{' '}
            <Link to="/privacy" className="text-primary font-semibold hover:underline">Privacy Policy</Link>
            .
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
            Questions about this DPA? Contact us at{' '}
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
