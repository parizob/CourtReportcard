import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function OurPlatformEditor() {
  const [accepted, setAccepted] = useState({})

  const acceptSuggestion = (key) => setAccepted((p) => ({ ...p, [key]: true }))

  return (
    <main className="min-h-screen bg-background">

      {/* Page Header */}
      <div className="px-8 lg:px-12 pt-8 pb-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-2 block">Step 2 of 3</span>
            <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">AI-Powered Transcript Editor</h1>
            <p className="font-body text-on-surface-variant mt-2 max-w-xl">
              This is your review workspace. Every error is flagged, every audio mismatch surfaced — all in a clean, distraction-free interface built for legal professionals.
            </p>
          </div>
          <Link
            to="/ourplatform/export"
            className="shrink-0 flex items-center gap-2 text-sm font-bold text-primary hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4"
          >
            Skip to Export <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 mt-5">
          {[
            { icon: 'psychology', text: 'Legal-Trained AI' },
            { icon: 'spellcheck', text: '12,400+ Legal Terms' },
            { icon: 'speed', text: '94% Faster Review' },
            { icon: 'history', text: 'Full Edit History' },
          ].map((pill) => (
            <span key={pill.text} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest rounded-full text-xs font-bold text-on-surface-variant editorial-shadow border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-sm">{pill.icon}</span>
              {pill.text}
            </span>
          ))}
        </div>

      </div>

      {/* Editor Interface — natural flow, page scrolls */}
      <div className="flex items-start bg-surface border-t border-outline-variant/10">

        {/* Transcript Canvas */}
        <section className="flex-1 bg-surface-container-low px-12 py-10">
          <div className="max-w-3xl mx-auto bg-surface-container-lowest p-12 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/10">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Case #882-J — Miller vs. Apex Corp</span>
              <span className="text-xs text-on-surface-variant/60 font-mono">Page 1 of 48</span>
            </div>

            <div className="space-y-10 font-mono text-[15px] leading-relaxed text-on-surface">
              {/* Entry 1 */}
              <div className="group">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MR. HENDERSON</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:12:45</span>
                </div>
                <p className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors cursor-pointer">
                  Please state for the record your name and occupation. We are proceeding with the{' '}
                  <span className="border-b-2 border-tertiary-fixed-dim cursor-help" title="Low confidence — verify against audio">deposition</span>{' '}
                  regarding the events of October 14th.
                </p>
              </div>

              {/* Entry 2 */}
              <div className="group">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MS. MILLER</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:13:02</span>
                </div>
                <p className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors cursor-pointer">
                  My name is Sarah Miller. I served as the{' '}
                  {accepted.principal ? (
                    <span className="text-green-600 font-semibold">principal</span>
                  ) : (
                    <span className="ring-2 ring-error ring-offset-2 rounded-sm px-1 cursor-pointer" title="Click to accept fix">pincipal</span>
                  )}{' '}
                  auditor for the firm. I was present during the initial audit of the offshore accounts.
                </p>
              </div>

              {/* Entry 3 */}
              <div className="group">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MR. HENDERSON</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:13:15</span>
                </div>
                <p className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors cursor-pointer">
                  And at that time, did you observe any{' '}
                  {accepted.irregularities ? (
                    <span className="text-green-600 font-semibold">irregularities</span>
                  ) : (
                    <span className="border-b-2 border-tertiary-fixed-dim cursor-pointer" title="Low confidence word">iregularities</span>
                  )}{' '}
                  in the ledger entries for the fourth quarter?
                </p>
              </div>

              {/* Entry 4 */}
              <div className="group">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MS. MILLER</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:13:28</span>
                </div>
                <p className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors cursor-pointer">
                  Yes. There were several entries that lacked supporting documentation. We flagged these as{' '}
                  <span className="ring-2 ring-error ring-offset-2 rounded-sm px-1">high-risk</span> transactions under the{' '}
                  {accepted.statute ? (
                    <span className="text-green-600 font-semibold">Statute of Limitations</span>
                  ) : (
                    <span className="border-b-2 border-tertiary-fixed-dim">Statute of Limitats</span>
                  )}.
                </p>
              </div>

              <div className="group opacity-40">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MR. HENDERSON</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:13:45</span>
                </div>
                <p className="pl-2">Can you elaborate on the specific nature of these flags? Were they automated or manual interventions?</p>
              </div>

              <div className="group opacity-40">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">MS. MILLER</span>
                  <span className="text-[10px] text-on-surface-variant/60">00:14:02</span>
                </div>
                <p className="pl-2">The flags were generated automatically by the internal audit system. However, I personally reviewed each one before submitting the final report to the compliance officer.</p>
              </div>

            </div>
          </div>
        </section>

        {/* Insights Sidebar — no internal scroll, grows with content */}
        <aside className="w-80 shrink-0 bg-surface border-l border-outline-variant/15">

          {/* Legend */}
          <div className="px-5 pt-5 pb-4 border-b border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How to read this transcript</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block ring-2 ring-error ring-offset-1 rounded-sm px-1.5 py-0.5 text-[11px] font-mono text-on-surface bg-surface-container-lowest mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-error">Critical error</span> — audio confirms a different word. Accept the fix from the card below.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block border-b-2 border-tertiary-fixed-dim text-[11px] font-mono text-on-surface px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-on-tertiary-container">Low confidence</span> — phoneme scan flagged this word. Verify against the audio recording.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block text-green-600 font-semibold text-[11px] font-mono px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-green-600">Accepted</span> — correction applied and logged to the audit trail.</span>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="p-5 border-b border-outline-variant/10 bg-surface-container-low">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-on-surface flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">auto_awesome</span>
                AI Insights
              </h2>
              <span className="bg-primary text-on-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                {3 - Object.keys(accepted).length} OPEN
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Click any suggestion to accept it instantly.</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Error 1 */}
            {!accepted.principal && (
              <div className="bg-error-container/30 p-4 rounded-lg border-l-4 border-error">
                <span className="text-[10px] font-bold text-error uppercase flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-xs">priority_high</span> Critical Error
                </span>
                <p className="text-sm font-medium mb-1">Found <strong>"pincipal"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Confirmed misspelling — audio clearly says "principal." Flagged with 99% confidence.</p>
                <button onClick={() => acceptSuggestion('principal')} className="w-full bg-on-error text-error text-xs font-bold py-2 rounded border border-error/20 hover:bg-error-container transition-colors">
                  Accept: "principal"
                </button>
              </div>
            )}

            {/* Error 2 */}
            {!accepted.irregularities && (
              <div className="bg-surface-container p-4 rounded-lg border-l-4 border-tertiary-fixed-dim">
                <span className="text-[10px] font-bold text-on-tertiary-container uppercase flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-xs">hearing</span> Low Confidence
                </span>
                <p className="text-sm font-medium mb-1">Found <strong>"iregularities"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Audio analysis suggests "irregularities." Double-r confirmed in phoneme scan.</p>
                <button onClick={() => acceptSuggestion('irregularities')} className="w-full bg-surface-container-lowest text-on-surface text-xs font-bold py-2 rounded hover:shadow-sm transition-all">
                  Accept: "irregularities"
                </button>
              </div>
            )}

            {/* Error 3 */}
            {!accepted.statute && (
              <div className="bg-surface-container p-4 rounded-lg border-l-4 border-tertiary-fixed-dim">
                <span className="text-[10px] font-bold text-on-tertiary-container uppercase flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-xs">gavel</span> Legal Context
                </span>
                <p className="text-sm font-medium mb-1">Found <strong>"Statute of Limitats"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Matched against legal dictionary — likely "Statute of Limitations" (12 U.S.C.).</p>
                <button onClick={() => acceptSuggestion('statute')} className="w-full bg-surface-container-lowest text-on-surface text-xs font-bold py-2 rounded hover:shadow-sm transition-all">
                  Accept: "Statute of Limitations"
                </button>
              </div>
            )}

            {/* All clear */}
            {Object.keys(accepted).length === 3 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-green-500 block mb-3">check_circle</span>
                <p className="font-bold text-on-surface mb-1">All Issues Resolved</p>
                <p className="text-xs text-on-surface-variant mb-4">Your transcript is court-ready. Time to export.</p>
                <Link to="/ourplatform/export" className="inline-block px-6 py-2 bg-primary text-on-primary rounded-md font-bold text-sm hover:bg-primary-container transition-colors">
                  Export Now →
                </Link>
              </div>
            )}
          </div>

          {/* Session Accuracy — bottom of sidebar */}
          <div className="px-5 pb-5 pt-4 border-t border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Session Accuracy</span>
              <span className="text-xl font-headline font-black text-primary">
                {Object.keys(accepted).length === 0 ? '94%' : Object.keys(accepted).length === 1 ? '96.5%' : Object.keys(accepted).length === 2 ? '98.2%' : '99.8%'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700"
                style={{ width: `${Object.keys(accepted).length === 0 ? 94 : Object.keys(accepted).length === 1 ? 96.5 : Object.keys(accepted).length === 2 ? 98.2 : 99.8}%` }}
              ></div>
            </div>
          </div>

        </aside>
      </div>

    </main>
  )
}
