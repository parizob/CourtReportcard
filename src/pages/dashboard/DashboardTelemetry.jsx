import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isTelemetryAdmin } from '../../lib/telemetry'

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-5 border border-outline-variant/15">
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-sm text-primary">{icon}</span>
        {label}
      </p>
      <p className="font-headline text-3xl font-extrabold text-on-surface">{value}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{sub}</p>}
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 border border-outline-variant/15">
      <h2 className="font-headline text-base font-bold text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardTelemetry() {
  const { user, loading } = useAuth()
  const [topEvents, setTopEvents] = useState([])
  const [pageViews, setPageViews] = useState([])
  const [audience, setAudience] = useState([])
  const [recent, setRecent] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const admin = isTelemetryAdmin(user?.email)

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const [top, pv, aud, rec] = await Promise.all([
        supabase.from('telemetry_top_events').select('*').limit(200),
        supabase.from('telemetry_page_views').select('*').limit(100),
        supabase.from('telemetry_prospect_vs_user').select('*'),
        supabase.from('telemetry_events').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      if (top.error) throw top.error
      setTopEvents(top.data || [])
      setPageViews(pv.data || [])
      setAudience(aud.data || [])
      setRecent(rec.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load telemetry.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (admin) load()
  }, [admin, load])

  if (loading) return null
  if (!admin) return <Navigate to="/dashboard" replace />

  const topClicks = topEvents.filter((e) => e.event_type === 'click').slice(0, 15)
  const totalEvents = topEvents.reduce((sum, e) => sum + Number(e.event_count || 0), 0)
  const prospectEvents = audience
    .filter((a) => a.audience === 'prospect')
    .reduce((s, a) => s + Number(a.event_count || 0), 0)
  const userEvents = audience
    .filter((a) => a.audience === 'authenticated')
    .reduce((s, a) => s + Number(a.event_count || 0), 0)

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-5xl mx-auto">

        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">monitoring</span>
              Internal
            </p>
            <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
              Telemetry
            </h1>
            <p className="text-on-surface-variant mt-2 text-sm max-w-xl leading-relaxed">
              Clicks and page views across the site for prospects and signed-in accounts.
            </p>
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="border-2 border-primary/30 text-primary px-5 py-2.5 rounded-md font-bold text-sm hover:bg-primary/10 hover:border-primary/10 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <span className={`material-symbols-outlined text-base${busy ? ' animate-spin' : ''}`}>
              {busy ? 'progress_activity' : 'refresh'}
            </span>
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon="bar_chart" label="Total Events" value={totalEvents.toLocaleString()} />
          <StatCard
            icon="person_off"
            label="Prospect Events"
            value={prospectEvents.toLocaleString()}
            sub="Unauthenticated visitors"
          />
          <StatCard
            icon="badge"
            label="Account Events"
            value={userEvents.toLocaleString()}
            sub="Signed-in users"
          />
        </div>

        <div className="space-y-8">

          <Section icon="ads_click" title="Top Clicks">
            {topClicks.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No click data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20">
                      <th className="py-2 pr-4">Element</th>
                      <th className="py-2 pr-4">From Page</th>
                      <th className="py-2 pr-4 text-right">Clicks</th>
                      <th className="py-2 text-right">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClicks.map((e, i) => (
                      <tr key={i} className="border-b border-outline-variant/10 last:border-0">
                        <td className="py-2.5 pr-4 font-semibold text-on-surface">{e.event_name || '—'}</td>
                        <td className="py-2.5 pr-4 text-on-surface-variant font-mono text-xs">{e.path || '—'}</td>
                        <td className="py-2.5 pr-4 text-right text-on-surface">{Number(e.event_count).toLocaleString()}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">{Number(e.unique_visitors).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section icon="description" title="Page Views">
            {pageViews.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No page views yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20">
                      <th className="py-2 pr-4">Page</th>
                      <th className="py-2 pr-4 text-right">Views</th>
                      <th className="py-2 pr-4 text-right">Visitors</th>
                      <th className="py-2 text-right">Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageViews.map((p, i) => (
                      <tr key={i} className="border-b border-outline-variant/10 last:border-0">
                        <td className="py-2.5 pr-4 font-mono text-xs text-on-surface">{p.path || '—'}</td>
                        <td className="py-2.5 pr-4 text-right text-on-surface">{Number(p.views).toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right text-on-surface-variant">{Number(p.unique_visitors).toLocaleString()}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">{Number(p.unique_users).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section icon="history" title="Recent Activity">
            {recent.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No recent activity.</p>
            ) : (
              <div className="space-y-1">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-0 text-sm"
                  >
                    <span className="material-symbols-outlined text-base text-on-surface-variant/70 shrink-0">
                      {r.event_type === 'page_view' ? 'visibility' : r.event_type === 'identify' ? 'how_to_reg' : 'ads_click'}
                    </span>
                    <span className="font-semibold text-on-surface truncate max-w-[40%]">{r.event_name || r.event_type}</span>
                    <span className="text-on-surface-variant font-mono text-xs truncate flex-1">{r.path}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        r.user_id ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {r.user_id ? 'Account' : 'Prospect'}
                    </span>
                    <span className="text-xs text-on-surface-variant/70 shrink-0 w-16 text-right">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      </div>
    </main>
  )
}
