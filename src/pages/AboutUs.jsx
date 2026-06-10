import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const stats = [
  { value: '98%', label: 'Avg. accuracy on first pass' },
  { value: '100×', label: 'Faster than manual review' },
  { value: '80%', label: 'Reduction in correction costs' },
  { value: '0', label: 'Data leaks or lost files — ever' },
]

const pillars = [
  {
    icon: 'spellcheck',
    title: 'What We Do',
    color: 'bg-secondary-container text-on-secondary-container',
    accent: 'border-secondary',
    body: 'Court Reportcard is a precision proofreading platform built exclusively for stenographers and digital court reporters. We scan every transcript line by line, flag mismatches, catch low-confidence words, and surface legal-dictionary errors — all before a single page leaves your desk.',
  },
  {
    icon: 'savings',
    title: 'A Fraction of the Cost',
    color: 'bg-tertiary-fixed/20 text-on-tertiary-container',
    accent: 'border-tertiary-fixed-dim',
    body: 'Traditional QA means hours of manual review at full billing rates. Court Reportcard cuts that to minutes. Whether you\'re a solo reporter or managing a firm, you recover time and margin on every job — without sacrificing the accuracy courts demand.',
  },
  {
    icon: 'folder_open',
    title: 'Everything in One Place',
    color: 'bg-primary-fixed/30 text-primary',
    accent: 'border-primary-fixed-dim',
    body: 'Upload transcripts and audio, review flagged errors, accept corrections, and export certified-ready documents — all inside a single dashboard. No more juggling email threads, shared drives, and third-party tools. Your case history is searchable and always accessible.',
  },
]

const timeline = [
  {
    year: '2022',
    heading: 'Where it started',
    detail: 'My wife — a veteran stenographer — would wrap a long deposition and need a second set of eyes before it went out. Her proofer was booked, on vacation, or just unavailable. The deadline never moved. I watched that happen enough times that I couldn\'t ignore it anymore.',
  },
  {
    year: '2024',
    heading: 'Into the community',
    detail: 'I started going to NCRA conferences with her every year. I loved it — the people, the craft, the pride reporters take in their work. And I kept hearing the same thing from everyone: the job is harder than it looks, the pressure is real, and nobody had built anything that truly understood that.',
  },
  {
    year: '2025',
    heading: 'First prototype',
    detail: 'I built something and handed it to my wife first. She was honest — brutally, helpfully honest. We refined it, passed it to a few other reporters, and watched review time drop in a way that actually mattered to their day. That\'s when we knew we had something worth building.',
  },
  {
    year: '2026',
    heading: 'Beta launch',
    detail: 'We opened Court Reportcard to reporters nationwide. No big announcement, no hype — just a quiet launch to a community we\'d spent years getting to know. The goal is still the same one that started all of this: be the reliable second set of eyes when no one else is available.',
  },
]

export default function AboutUs() {
  const { openModal } = useAuth()
  const timelineRefs = useRef([])

  useEffect(() => {
    const items = timelineRefs.current.filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1'
            entry.target.style.transform = 'translateY(0)'
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-background text-on-surface font-body min-h-screen">
      <Helmet>
        <title>About Us | Court Reportcard</title>
        <meta name="description" content="Court Reportcard was built for court reporters who demand accuracy. Learn about our mission to bring precision proofreading technology to the legal transcription industry." />
        <link rel="canonical" href="https://www.courtreportcard.com/aboutus" />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 sm:px-8 pt-8 sm:pt-10 pb-12 sm:pb-20 max-w-[1440px] mx-auto">
        {/* decorative blobs */}
        <div className="absolute -top-16 -right-32 w-[520px] h-[520px] bg-secondary-container rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute top-0 -left-24 w-[340px] h-[340px] bg-tertiary-fixed rounded-full opacity-10 blur-3xl pointer-events-none" />

        {/* Two-column hero */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — text */}
          <div>
            <h1 className="font-headline font-extrabold text-4xl sm:text-6xl lg:text-7xl text-on-surface leading-[1.08] tracking-tight mb-6">
              We exist because<br />
              <span className="text-primary italic">court reporters</span><br />
              deserve better
            </h1>
            <p className="text-base sm:text-xl text-on-surface-variant leading-relaxed max-w-2xl">
              My wife is a veteran stenographer. Watching her spend as many hours reviewing a transcript as she did recording it — under deadline, alone — made one thing clear: the work was consequential and the tools hadn't kept up. We couldn't walk away from that.
            </p>
          </div>

          {/* Right — Two Paths visual */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm">

              {/* Origin node */}
              <div className="flex flex-col items-center mb-4">
                <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-5 py-2.5 flex items-center gap-2 editorial-shadow">
                  <span className="material-symbols-outlined text-on-surface-variant text-base" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                  <span className="text-xs font-bold text-on-surface">Raw Transcript</span>
                </div>
                <div className="w-0.5 h-5 bg-outline-variant/60 mt-1" />
                {/* Fork */}
                <div className="w-48 h-0.5 bg-outline-variant/50" />
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-2 gap-3">

                {/* Old way */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">The Old Way</span>
                  <div className="w-0.5 h-3 bg-outline-variant/50" />
                  {[
                    { icon: 'person_search', label: 'Find a scopist', sub: '1–2 days wait' },
                    { icon: 'payments',      label: 'Pay per job',    sub: '$150–$400' },
                    { icon: 'schedule',      label: 'Miss deadlines', sub: 'Turnaround: days' },
                  ].map((step) => (
                    <div key={step.label} className="w-full">
                      <div className="bg-surface-container/60 border border-outline-variant/15 rounded-xl px-3 py-2.5 flex items-center gap-2 opacity-60">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                        <div>
                          <p className="text-[10px] font-semibold text-on-surface leading-tight">{step.label}</p>
                          <p className="text-[9px] text-on-surface-variant">{step.sub}</p>
                        </div>
                      </div>
                      <div className="flex justify-center"><div className="w-0.5 h-3 bg-outline-variant/50" /></div>
                    </div>
                  ))}
                </div>

                {/* Court Reportcard way */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Court Reportcard</span>
                  <div className="w-0.5 h-3 bg-primary/60" />
                  {[
                    { icon: 'upload_file',  label: 'Upload transcript', sub: '30 seconds' },
                    { icon: 'auto_fix_high', label: 'Errors detected',   sub: '< 3 minutes' },
                    { icon: 'task_alt',     label: 'Accept & export',    sub: 'Cents per page' },
                  ].map((step) => (
                    <div key={step.label} className="w-full">
                      <div className="bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                        <div>
                          <p className="text-[10px] font-semibold text-on-surface leading-tight">{step.label}</p>
                          <p className="text-[9px] text-primary/70">{step.sub}</p>
                        </div>
                      </div>
                      <div className="flex justify-center"><div className="w-0.5 h-3 bg-primary/50" /></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Converge node */}
              <div className="flex flex-col items-center mt-1">
                <div className="w-48 h-0.5 bg-outline-variant/50" />
                <div className="w-0.5 h-4 bg-outline-variant/60" />
                <div className="bg-primary rounded-xl px-5 py-2.5 flex items-center gap-2 editorial-shadow">
                  <span className="material-symbols-outlined text-on-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className="text-xs font-bold text-on-primary">Court-Ready Document</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-6 editorial-shadow border border-outline-variant/10">
              <p className="font-headline font-black text-4xl text-primary mb-1">{s.value}</p>
              <p className="text-xs text-on-surface-variant leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three Pillars */}
      <section className="bg-surface-container-low py-14 sm:py-20 px-6 sm:px-8">
        <div className="max-w-[1440px] mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">The Platform</p>
          <h2 className="font-headline font-extrabold text-3xl sm:text-4xl text-on-surface mb-8 sm:mb-12 max-w-xl">Three things we obsess over</h2>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {pillars.map((p) => (
              <div key={p.title} className={`bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border-t-4 ${p.accent}`}>
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl mb-6 ${p.color}`}>
                  <span className="material-symbols-outlined">{p.icon}</span>
                </span>
                <h3 className="font-headline font-bold text-xl text-on-surface mb-3">{p.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why we do it — origin story */}
      <section className="py-14 sm:py-24 px-6 sm:px-8 max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 items-start">

          {/* Left — copy */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Our Story</p>
            <h2 className="font-headline font-extrabold text-3xl sm:text-4xl text-on-surface mb-6 leading-tight">
              Why we built this
            </h2>
            <p className="text-base text-on-surface-variant leading-relaxed mb-5">
              Court reporting is one of the last skilled professions that the modern software industry largely ignored. These reporters sit in high-pressure rooms — depositions, trials, grand juries — capturing every spoken word verbatim. A single missed phrase can affect a case outcome.
            </p>
            <p className="text-base text-on-surface-variant leading-relaxed mb-5">
              After watching how long post-session review actually takes, and hearing the anxiety around certification deadlines, we became convinced: this problem is solvable with the right technology.
            </p>
            <p className="text-base text-on-surface-variant leading-relaxed">
              Court Reportcard was built with deep respect for the craft. We don't try to replace the reporter — we remove the tedium so they can focus on what only a skilled human can do: guarantee accuracy under oath.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={() => openModal('signup')}
                className="flex-1 sm:flex-none text-center bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-md font-bold text-sm hover:translate-y-[-1px] transition-all editorial-shadow"
              >
                Try the Platform
              </button>
              <Link
                to="/ourplatform"
                className="flex-1 sm:flex-none text-center border border-outline-variant/40 text-on-surface px-6 py-3 rounded-md font-bold text-sm hover:bg-surface-container transition-colors"
              >
                See the Platform
              </Link>
            </div>
          </div>

          {/* Right — timeline */}
          <div className="relative pl-6 border-l-2 border-outline-variant/30 space-y-10">
            {timeline.map((t, i) => (
              <div
                key={t.year}
                ref={(el) => { timelineRefs.current[i] = el }}
                className="relative"
                style={{
                  opacity: 0,
                  transform: 'translateY(20px)',
                  transition: `opacity 0.55s ease, transform 0.55s ease`,
                  transitionDelay: `${i * 120}ms`,
                }}
              >
                <span className="absolute -left-[2.15rem] top-1 w-7 h-7 rounded-full bg-surface-container-lowest border-2 border-primary flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary block" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-1">{t.year}</p>
                <h4 className="font-headline font-bold text-base text-on-surface mb-1">{t.heading}</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA banner */}
      <section className="bg-primary text-on-primary py-14 sm:py-20 px-6 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-2xl sm:text-3xl mb-2">Ready to see it in action?</h2>
            <p className="text-on-primary/70 text-sm sm:text-base">Upload your first transcript in under a minute. No credit card required.</p>
          </div>
          <button
            onClick={() => openModal('signup')}
            className="shrink-0 bg-tertiary-fixed-dim text-on-tertiary-fixed px-8 py-4 rounded-md font-bold text-base hover:brightness-105 transition-all editorial-shadow"
          >
            Start for Free →
          </button>
        </div>
      </section>

      <SiteFooter />

    </div>
  )
}
