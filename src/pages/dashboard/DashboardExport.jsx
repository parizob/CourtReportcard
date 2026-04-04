import { useState } from 'react'
import { Link } from 'react-router-dom'

const qaStats = [
  { value: '124', label: 'Typos Fixed', color: 'text-primary' },
  { value: '18', label: 'Audio Gaps Filled', color: 'text-tertiary-fixed-dim' },
  { value: '99.8%', label: 'Precision Score', color: 'text-on-secondary-container' },
  { value: '0', label: 'Critical Conflicts', color: 'text-green-500' },
]

export default function DashboardExport() {
  const [formats, setFormats] = useState({ pdf: true, word: true, txt: false, catalyst: true })
  const selectedCount = Object.values(formats).filter(Boolean).length
  const toggle = (k) => setFormats((p) => ({ ...p, [k]: !p[k] }))
  const [exported, setExported] = useState(false)

  return (
    <main className="min-h-screen bg-background p-8 lg:p-12 overflow-y-auto">

      {/* Page Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">cloud_download</span>
              Export Center
            </p>
            <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Export &amp; Archive</h1>
            <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
              Your transcript is court-ready. Choose formats, review the QA summary, and export.
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

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Left Column */}
        <div className="lg:col-span-7 space-y-8">

          {/* QA Summary */}
          <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <div>
                <h2 className="font-headline font-bold text-xl text-on-surface">Quality Assurance Summary</h2>
                <p className="text-xs text-on-surface-variant">Automatically generated after every AI review session</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {qaStats.map((s) => (
                <div key={s.label} className="bg-surface-container-low p-4 rounded-xl text-center">
                  <p className={`text-2xl font-headline font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-tertiary-fixed/20 border-l-4 border-tertiary-fixed rounded-lg">
              <p className="text-xs text-on-surface"><span className="font-bold">Zero court rejections.</span> Every transcript exported through Court Reportcard meets District and Federal formatting guidelines.</p>
            </div>
          </div>

          {/* Document Preview */}
          <div className="bg-surface-container-lowest rounded-sm editorial-shadow p-10 relative">
            <div className="absolute top-6 right-6 text-[10px] font-bold text-outline-variant uppercase tracking-widest">Preview — Confidential</div>
            <div className="space-y-8">
              <div className="border-b border-outline-variant/15 pb-6">
                <h3 className="font-headline text-xl font-bold text-on-surface">Official Court Transcript</h3>
                <p className="text-xs text-on-surface-variant mt-1">VOLUME I • FEBRUARY 14, 2026 • Case #4492-B: State vs. Miller</p>
              </div>
              <div className="space-y-6 text-on-surface leading-relaxed">
                <div className="flex items-start gap-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1">JUDGE</span>
                  <p className="font-body text-sm">Please state your name for the record and proceed with the opening statement for the defense.</p>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1">WITNESS</span>
                  <p className="font-body text-sm">My name is Dr. Aris Thorne. I was present at the facility during the alleged structural failure on the night of November 12th.</p>
                </div>
                <div className="flex items-start gap-4">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1">COUNCIL</span>
                  <p className="font-body text-sm">And Dr. Thorne, can you describe the exact sequence of events leading up to the structural compromise?</p>
                </div>
                <div className="pt-6 opacity-20 space-y-2">
                  <div className="w-full h-px bg-on-surface" />
                  <div className="w-2/3 h-px bg-on-surface" />
                  <div className="w-1/2 h-px bg-on-surface" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">

          {/* Export Format Picker */}
          <div className="bg-surface-container-lowest rounded-2xl p-8 editorial-shadow sticky top-8">
            <h2 className="font-headline font-bold text-xl text-on-surface mb-1">Select Export Formats</h2>
            <p className="text-xs text-on-surface-variant mb-6">Choose the formats you need — all generated simultaneously.</p>
            <div className="space-y-3">
              {[
                { key: 'pdf', icon: 'picture_as_pdf', iconClass: 'text-red-600 bg-red-50', label: 'Adobe PDF', sub: 'Standard Legal Layout — court-submission ready' },
                { key: 'word', icon: 'description', iconClass: 'text-blue-600 bg-blue-50', label: 'Microsoft Word', sub: 'Editable .docx for further annotation' },
                { key: 'txt', icon: 'article', iconClass: 'text-on-surface-variant bg-surface-container-high', label: 'Plain Text', sub: 'Unformatted .txt for archiving' },
              ].map(({ key, icon, iconClass, label, sub }) => (
                <label key={key} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${formats[key] ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-primary/40'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded flex items-center justify-center ${iconClass}`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-xs text-on-surface-variant">{sub}</p>
                    </div>
                  </div>
                  <input type="checkbox" checked={formats[key]} onChange={() => toggle(key)} className="w-5 h-5 rounded-sm text-primary cursor-pointer" />
                </label>
              ))}

              <div className="pt-3">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-3">Stenography Specialized</p>
                <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${formats.catalyst ? 'border-primary bg-primary/5' : 'border-primary/20 hover:border-primary/50'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center">
                      <span className="material-symbols-outlined">keyboard</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Case CATalyst / Eclipse</p>
                      <p className="text-xs text-on-surface-variant">Raw steno &amp; dictionary sync</p>
                    </div>
                  </div>
                  <input type="checkbox" checked={formats.catalyst} onChange={() => toggle('catalyst')} className="w-5 h-5 rounded-sm text-primary cursor-pointer" />
                </label>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {exported ? (
                <div className="w-full bg-green-50 border border-green-200 text-green-700 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {selectedCount} {selectedCount === 1 ? 'file' : 'files'} exported successfully!
                </div>
              ) : (
                <button
                  onClick={() => setExported(true)}
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-headline font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 editorial-shadow"
                >
                  <span className="material-symbols-outlined">file_download</span>
                  Process Export ({selectedCount} {selectedCount === 1 ? 'File' : 'Files'})
                </button>
              )}
              <p className="text-center text-[10px] text-on-surface-variant opacity-70">Automatically logged to your digital archive. Encrypted link expires in 24 hours.</p>
            </div>
          </div>

          {/* Info cards */}
          <div className="space-y-4">
            {[
              { icon: 'verified', title: 'Court-Certified Formatting', body: 'Every export matches District and Federal Court submission standards.' },
              { icon: 'history_edu', title: 'Immutable Audit Trail', body: 'Every edit is logged. Your chain of custody is airtight and defensible.' },
              { icon: 'lock', title: 'Encrypted Delivery', body: 'Files delivered via encrypted links that expire after 24 hours.' },
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
        </div>
      </div>
    </main>
  )
}
