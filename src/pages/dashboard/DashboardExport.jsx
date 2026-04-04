import { Link } from 'react-router-dom'

export default function DashboardExport() {
  return (
    <main className="min-h-screen bg-background p-8 lg:p-12">
      <div className="max-w-6xl mx-auto">

        {/* Page Header */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">cloud_download</span>
                Export Center
              </p>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Export &amp; Archive</h1>
              <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
                Once you've reviewed a transcript in the editor, export it here in any format you need.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="shrink-0 flex items-center gap-2 text-sm font-bold text-primary"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4">Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-16 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-5xl">file_download_off</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">No transcripts ready for export</h2>
          <p className="text-sm text-on-surface-variant max-w-lg leading-relaxed mb-8">
            You haven't reviewed any transcripts yet. Upload a case, review it in the editor, and then come back here to export court-ready files in PDF, Word, or Case CATalyst format.
          </p>
          <div className="flex gap-3">
            <Link
              to="/dashboard/upload"
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
            >
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              Upload a Case
            </Link>
            <Link
              to="/dashboard/editor"
              className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Open Editor
            </Link>
          </div>
        </div>

        {/* Supported formats */}
        <section className="mt-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Supported Export Formats</p>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon: 'picture_as_pdf', iconClass: 'text-red-600 bg-red-50', label: 'Adobe PDF', sub: 'Court-submission ready' },
              { icon: 'description', iconClass: 'text-blue-600 bg-blue-50', label: 'Microsoft Word', sub: 'Editable .docx' },
              { icon: 'article', iconClass: 'text-on-surface-variant bg-surface-container-high', label: 'Plain Text', sub: 'Archival .txt' },
              { icon: 'keyboard', iconClass: 'text-on-primary bg-primary', label: 'Case CATalyst', sub: 'Steno & dictionary sync' },
            ].map((fmt) => (
              <div key={fmt.label} className="bg-surface-container-lowest rounded-xl p-5 editorial-shadow flex items-center gap-4">
                <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${fmt.iconClass}`}>
                  <span className="material-symbols-outlined">{fmt.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{fmt.label}</p>
                  <p className="text-[10px] text-on-surface-variant">{fmt.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-8">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: 'verified', title: 'Court-Certified', body: 'Every export meets District and Federal Court formatting standards automatically.' },
              { icon: 'history_edu', title: 'Audit Trail', body: 'Every edit, suggestion, and acceptance is logged with an immutable chain of custody.' },
              { icon: 'lock', title: 'Encrypted', body: 'Files delivered via encrypted download links that expire after 24 hours.' },
            ].map((c) => (
              <div key={c.title} className="bg-surface-container-low p-5 rounded-2xl flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container">{c.icon}</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-on-surface mb-1">{c.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
