import { useState } from 'react'
import { Link } from 'react-router-dom'

const callouts = [
  {
    id: 'error',
    anchor: 'top-[120px] left-[calc(50%-380px)]',
    line: 'right-0 top-1/2',
    title: 'Critical Error Detection',
    body: 'Our AI cross-references every word against 12,400+ legal terms and audio frequency data — catching typos that pass human review.',
    color: 'border-error',
    dotColor: 'bg-error',
  },
  {
    id: 'audio',
    anchor: 'bottom-[100px] left-[calc(50%-380px)]',
    title: 'Synchronized Audio Playback',
    body: 'Jump to any moment in the recording by clicking any line of text. No more scrubbing through hours of audio.',
    color: 'border-primary',
    dotColor: 'bg-primary',
  },
  {
    id: 'insights',
    anchor: 'top-[120px] right-[20px]',
    title: 'Real-Time AI Insights',
    body: 'Every session surfaces a prioritized list of corrections — sorted by severity so you tackle the most critical issues first.',
    color: 'border-tertiary-fixed-dim',
    dotColor: 'bg-tertiary-fixed-dim',
  },
]

export default function OurPlatformEditor() {
  const [isPlaying, setIsPlaying] = useState(false)
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
            { icon: 'record_voice_over', text: 'Audio Sync' },
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

      {/* Editor Interface */}
      <div className="flex h-[calc(100vh-260px)] min-h-[600px] bg-surface border-t border-outline-variant/10">

        {/* Transcript Canvas */}
        <section className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-low px-12 py-10 pb-24 relative">

          {/* Annotated callout — Critical Error */}
          <div className="hidden xl:block absolute left-2 top-28 w-52 bg-surface-container-lowest p-3 rounded-xl editorial-shadow border-l-4 border-error z-10">
            <p className="text-[10px] font-bold uppercase text-error mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">error</span> Auto-Detected
            </p>
            <p className="text-xs text-on-surface leading-snug">AI catches <strong>"pincipal"</strong> before it ever reaches the judge.</p>
          </div>

          {/* Annotated callout — Low Confidence */}
          <div className="hidden xl:block absolute left-2 top-64 w-52 bg-surface-container-lowest p-3 rounded-xl editorial-shadow border-l-4 border-tertiary-fixed-dim z-10">
            <p className="text-[10px] font-bold uppercase text-on-tertiary-container mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">hearing</span> Audio Mismatch
            </p>
            <p className="text-xs text-on-surface leading-snug">Flags words where the audio doesn't match the transcript — every single time.</p>
          </div>

          <div className="max-w-3xl mx-auto bg-surface-container-lowest p-12 shadow-sm min-h-full">
            {/* Case badge */}
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

              {/* Entry 2 — with critical error */}
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
            </div>
          </div>
        </section>

        {/* Insights Sidebar */}
        <aside className="w-80 bg-surface border-l border-outline-variant/15 flex flex-col">
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

          <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {/* Error 1 */}
            {!accepted.principal && (
              <div className="bg-error-container/30 p-4 rounded-lg border-l-4 border-error">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-error uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">priority_high</span> Critical Error
                  </span>
                </div>
                <p className="text-sm font-medium mb-1">Found <strong>"pincipal"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Confirmed misspelling — audio clearly says "principal." Flagged with 99% confidence.</p>
                <button
                  onClick={() => acceptSuggestion('principal')}
                  className="w-full bg-on-error text-error text-xs font-bold py-2 rounded border border-error/20 hover:bg-error-container transition-colors"
                >
                  Accept: "principal"
                </button>
              </div>
            )}

            {/* Error 2 */}
            {!accepted.irregularities && (
              <div className="bg-surface-container p-4 rounded-lg border-l-4 border-tertiary-fixed-dim">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-on-tertiary-container uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">hearing</span> Low Confidence
                  </span>
                </div>
                <p className="text-sm font-medium mb-1">Found <strong>"iregularities"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Audio analysis suggests "irregularities." Double-r confirmed in phoneme scan.</p>
                <button
                  onClick={() => acceptSuggestion('irregularities')}
                  className="w-full bg-surface-container-lowest text-on-surface text-xs font-bold py-2 rounded hover:shadow-sm transition-all"
                >
                  Accept: "irregularities"
                </button>
              </div>
            )}

            {/* Error 3 */}
            {!accepted.statute && (
              <div className="bg-surface-container p-4 rounded-lg border-l-4 border-tertiary-fixed-dim">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-on-tertiary-container uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">gavel</span> Legal Context
                  </span>
                </div>
                <p className="text-sm font-medium mb-1">Found <strong>"Statute of Limitats"</strong></p>
                <p className="text-xs text-on-surface-variant mb-3">Matched against legal dictionary — likely "Statute of Limitations" (12 U.S.C.).</p>
                <button
                  onClick={() => acceptSuggestion('statute')}
                  className="w-full bg-surface-container-lowest text-on-surface text-xs font-bold py-2 rounded hover:shadow-sm transition-all"
                >
                  Accept: "Statute of Limitations"
                </button>
              </div>
            )}

            {/* All clear state */}
            {Object.keys(accepted).length === 3 && (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-4xl text-green-500 block mb-3">check_circle</span>
                <p className="font-bold text-on-surface mb-1">All Issues Resolved</p>
                <p className="text-xs text-on-surface-variant mb-4">Your transcript is court-ready. Time to export.</p>
                <Link
                  to="/ourplatform/export"
                  className="inline-block px-6 py-2 bg-primary text-on-primary rounded-md font-bold text-sm hover:bg-primary-container transition-colors"
                >
                  Export Now →
                </Link>
              </div>
            )}
          </div>

          {/* Accuracy Badge */}
          <div className="p-5 bg-surface-container-low border-t border-outline-variant/10">
            <div className="flex items-center justify-between mb-3">
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
            <Link
              to="/ourplatform/export"
              className="mt-4 w-full bg-primary text-on-primary py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              Confirm & Export
            </Link>
          </div>
        </aside>
      </div>

      {/* Floating Audio Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+128px)] w-[560px] max-w-[calc(100vw-2rem)] h-14 bg-surface-container-lowest/90 backdrop-blur-xl rounded-full border border-outline-variant/15 shadow-2xl flex items-center px-6 gap-5 z-20">
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight whitespace-nowrap hidden sm:block">Audio Sync</div>
        <div className="h-4 w-[1px] bg-outline-variant/30 hidden sm:block"></div>
        <button className="text-on-surface hover:text-primary transition-colors">
          <span className="material-symbols-outlined">replay_10</span>
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <button className="text-on-surface hover:text-primary transition-colors">
          <span className="material-symbols-outlined">forward_10</span>
        </button>
        <div className="flex-1 h-1.5 bg-outline-variant/20 rounded-full relative cursor-pointer">
          <div className="absolute left-0 top-0 h-full w-1/3 bg-primary rounded-full"></div>
          <div className="absolute left-1/3 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-primary rounded-full shadow-lg border-2 border-surface-container-lowest"></div>
        </div>
        <span className="text-[10px] font-bold text-on-surface font-mono whitespace-nowrap">00:13:28 / 00:48:12</span>
      </div>
    </main>
  )
}
