import { Link } from 'react-router-dom'

export default function DashboardEditor() {
  return (
    <main className="min-h-screen bg-background">

      {/* Page Header */}
      <div className="px-8 lg:px-12 pt-8 pb-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">edit_note</span>
              Transcript Review
            </p>
            <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Editor</h1>
            <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
              Review AI-flagged issues, accept corrections, and finalize your transcript before export.
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex items-start bg-surface border-t border-outline-variant/10">
        <div className="flex-1 flex flex-col items-center justify-center py-32 px-8">
          <div className="w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-primary text-5xl">edit_document</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3 text-center">No transcript selected</h2>
          <p className="text-sm text-on-surface-variant max-w-md text-center leading-relaxed mb-8">
            Upload a case from your dashboard to open it in the editor. Once analyzed, you'll see AI-flagged errors, suggested corrections, and an accuracy score here.
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
              to="/dashboard"
              className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </Link>
          </div>

          {/* How it works */}
          <div className="mt-16 w-full max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 text-center">How the editor works</p>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-error">priority_high</span>
                </div>
                <p className="text-xs font-bold text-on-surface mb-1">Critical Errors</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">Audio confirms a different word. Accept the AI-suggested fix instantly.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/20 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim">hearing</span>
                </div>
                <p className="text-xs font-bold text-on-surface mb-1">Low Confidence</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">Phoneme scan flagged this word. Verify against the audio recording.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                </div>
                <p className="text-xs font-bold text-on-surface mb-1">Accepted</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">Correction applied and logged to the immutable audit trail.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
