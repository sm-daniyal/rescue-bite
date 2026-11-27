/**
 * DemoConsole — isolated judge walkthrough controller at route "/demo".
 *
 * Allows competition evaluators to trigger deterministic surplus scenarios (A/B/C),
 * inspect real-time SSE telemetry latency, and verify backend health without cluttering
 * either the Student App ("/") or Merchant POS Terminal ("/partner").
 *
 * Zero emojis. Strict TypeScript.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Play,
  Radio,
  RefreshCw,
  Server,
  Terminal,
  Utensils,
  XCircle,
} from 'lucide-react'
import { api, type FlashDeal } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { useSSE, type SSEEvent } from '../hooks/useSSE'

type ScenarioKey = 'A' | 'B' | 'C'

interface ScenarioSpec {
  key: ScenarioKey
  badge: string
  title: string
  subtitle: string
  restaurant: string
  partnerHint: string
  item: string
  priceLine: string
  windowMin: number
  steps: string[]
  accent: 'orange' | 'amber' | 'rose'
}

interface TriggerResponse {
  status: string
  scenario: string
  name: string | null
  deal_id: number
  restaurant: string | null
  item: string | null
  discount_pct: number
  reasoning: string
  offline_cached: boolean
}

interface TelemetryEntry {
  id: number
  timestamp: string
  eventType: string
  summary: string
  latencyMs: number | null
}

const SCENARIOS: ScenarioSpec[] = [
  {
    key: 'A',
    badge: 'Scenario A · Core Rescue Loop',
    title: 'Lunch Rescue — Biryani Paradise',
    subtitle: 'Triggers peak post-lunch surplus deal and pushes new_deal over SSE.',
    restaurant: 'Biryani Paradise (#5)',
    partnerHint: 'Select "Biryani Paradise" in /partner',
    item: 'Hyderabadi Chicken Biryani (8 portions)',
    priceLine: '51% off · ₹175 → ₹86',
    windowMin: 45,
    accent: 'orange',
    steps: [
      'Click Trigger Scenario A below.',
      'Observe the card appear live on / (Student App).',
      'Tap Reserve Hold on /, then Confirm & Mark Picked Up in /partner.',
    ],
  },
  {
    key: 'B',
    badge: 'Scenario B · Break Bell Alert',
    title: 'Evening Snack Bell — Meenakshi Bhavan',
    subtitle: 'Broadcasts break_bell event to activate the student Break Bell toast/banner.',
    restaurant: 'Meenakshi Bhavan Darshini (#3)',
    partnerHint: 'Select "Meenakshi Bhavan Darshini" in /partner',
    item: 'Idli Vada Combo (15 portions)',
    priceLine: '38% off · ₹45 → ₹28',
    windowMin: 30,
    accent: 'amber',
    steps: [
      'Click Trigger Scenario B below.',
      'Observe Break Bell banner/toast fire instantly on /.',
      'Click View to jump directly to the live Flash Deals tab.',
    ],
  },
  {
    key: 'C',
    badge: 'Scenario C · Exception Handling',
    title: 'Counter Stockout Rejection — Sri Venkateshwara',
    subtitle: 'Publishes deal #C so evaluator can test merchant counter rejection + reason code.',
    restaurant: 'Sri Venkateshwara Grand (#2)',
    partnerHint: 'Select "Sri Venkateshwara Grand" in /partner',
    item: 'Executive Veg Meals (4 portions)',
    priceLine: '45% off · ₹110 → ₹61',
    windowMin: 35,
    accent: 'rose',
    steps: [
      'Click Trigger Scenario C and reserve Executive Veg Meals on /.',
      'Switch to /partner (Sri Venkateshwara Grand) and click Reject.',
      'Choose "item_unavailable" and verify instant rejection notice on /.',
    ],
  },
]

function summarizeEvent(ev: SSEEvent): string {
  switch (ev.type) {
    case 'connected':
      return `SSE handshake confirmed (student #${ev.student_id ?? 1})`
    case 'new_deal':
      return `new_deal #${ev.deal.id}: ${ev.deal.item?.name ?? 'Item'} (${ev.deal.discount_pct}% off)`
    case 'break_bell':
      return `break_bell broadcast: ${ev.deal_count} deal(s) active`
    case 'new_reservation':
      return `new_reservation #RB-${ev.reservation.id}`
    case 'reservation_update':
      return `reservation_update #RB-${ev.reservation.id} → ${ev.reservation.status}`
    default:
      return `event received (${ev.type})`
  }
}

export function DemoConsole() {
  const [health, setHealth] = useState<{ status: string; env: string } | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [activeDeals, setActiveDeals] = useState<FlashDeal[]>([])
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)

  const [triggeringKey, setTriggeringKey] = useState<ScenarioKey | null>(null)
  const [lastResult, setLastResult] = useState<TriggerResponse | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [logs, setLogs] = useState<TelemetryEntry[]>([])

  const triggerStartMsRef = useRef<number | null>(null)
  const logSeqRef = useRef<number>(1)

  const appendLog = useCallback((eventType: string, summary: string, latencyMs: number | null) => {
    const entry: TelemetryEntry = {
      id: logSeqRef.current++,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      eventType,
      summary,
      latencyMs,
    }
    setLogs(prev => [entry, ...prev].slice(0, 12))
  }, [])

  const refreshSnapshot = useCallback(async () => {
    try {
      setLoadingSnapshot(true)
      setHealthError(null)
      const [healthRes, dealsRes] = await Promise.all([
        fetch(`${API_BASE}/`).then(async r => {
          if (!r.ok) throw new Error(`Health check HTTP ${r.status}`)
          return (await r.json()) as { status: string; env: string }
        }),
        api.getDeals(),
      ])
      setHealth(healthRes)
      setActiveDeals(dealsRes)
    } catch (err: unknown) {
      setHealth(null)
      setHealthError(err instanceof Error ? err.message : 'Unable to reach backend API')
    } finally {
      setLoadingSnapshot(false)
    }
  }, [])

  useEffect(() => {
    void refreshSnapshot()
  }, [refreshSnapshot])

  const { status: sseStatus, reconnect } = useSSE<SSEEvent>(`${API_BASE}/sse/student/1`, {
    onMessage: event => {
      const nowMs = performance.now()
      const latency =
        triggerStartMsRef.current !== null &&
        (event.type === 'new_deal' || event.type === 'break_bell')
          ? Math.round(nowMs - triggerStartMsRef.current)
          : null

      if (latency !== null) {
        triggerStartMsRef.current = null
      }

      appendLog(event.type, summarizeEvent(event), latency)

      if (event.type === 'new_deal' || event.type === 'break_bell') {
        void api.getDeals().then(setActiveDeals).catch(() => {})
      }
    },
  })

  const handleTrigger = async (key: ScenarioKey) => {
    try {
      setTriggeringKey(key)
      setTriggerError(null)
      triggerStartMsRef.current = performance.now()

      const resp = await fetch(`${API_BASE}/demo/trigger-scenario/${key}`, {
        method: 'POST',
      })

      if (!resp.ok) {
        let detail = `Scenario ${key} failed with HTTP ${resp.status}`
        try {
          const errJson = (await resp.json()) as { detail?: string }
          if (errJson.detail) detail = errJson.detail
        } catch {
          // ignore non-JSON body
        }
        throw new Error(detail)
      }

      const data = (await resp.json()) as TriggerResponse
      setLastResult(data)
      appendLog(`trigger_${key}`, `Dispatched ${data.item ?? `Scenario ${key}`} (Deal #${data.deal_id})`, null)
      const updatedDeals = await api.getDeals()
      setActiveDeals(updatedDeals)
    } catch (err: unknown) {
      triggerStartMsRef.current = null
      setTriggerError(err instanceof Error ? err.message : 'Failed to trigger scenario')
    } finally {
      setTriggeringKey(null)
    }
  }

  const sseBadgeCls =
    sseStatus === 'live'
      ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
      : sseStatus === 'reconnecting'
      ? 'border-amber-700 bg-amber-950/60 text-amber-300'
      : 'border-rose-700 bg-rose-950/60 text-rose-300'

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-white font-black text-xs">
            SR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Swiggy <span className="text-orange-400">Rescue</span>
              </span>
              <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                Judge Console
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Swiggy Food for Thought 2.0 (2026–27) · Evaluation Harness
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${sseBadgeCls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sseStatus === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            SSE {sseStatus}
          </span>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Student App (/)
          </a>

          <a
            href="/partner"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Partner POS (/partner)
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Evaluator setup instructions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-600/20 border border-orange-700/50 text-orange-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Isolated Judge Evaluation Walkthrough</h1>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Open <code className="rounded bg-slate-800 px-1.5 py-0.5 text-orange-300">/</code> in Tab 1 (Student App) and{' '}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-orange-300">/partner</code> in Tab 2 (Merchant POS Terminal),
                then trigger deterministic scenarios below. All scenarios use pre-cached Gemini Flash responses for zero-failure offline demos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void refreshSnapshot()
              reconnect()
            }}
            className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingSnapshot ? 'animate-spin' : ''}`} />
            Sync Telemetry
          </button>
        </section>

        {/* Backend status alerts */}
        {healthError && (
          <div className="rounded-xl border border-rose-700 bg-rose-950/70 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Backend unreachable at <code>{API_BASE}</code> ({healthError}). Start FastAPI or check CORS/URL.</span>
            </div>
            <button
              type="button"
              onClick={() => void refreshSnapshot()}
              className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-rose-700 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {health && health.env !== 'development' && (
          <div className="rounded-xl border border-amber-700 bg-amber-950/60 px-4 py-3 text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Backend reports <code>ENVIRONMENT={health.env}</code>. Scenario triggers require <code>ENVIRONMENT=development</code>; otherwise the API enforces 403 Forbidden.
            </span>
          </div>
        )}

        {triggerError && (
          <div className="rounded-xl border border-rose-700 bg-rose-950/70 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{triggerError}</span>
            </div>
            <button type="button" onClick={() => setTriggerError(null)} className="font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Three Scenario Trigger Cards */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SCENARIOS.map(s => {
            const isTriggering = triggeringKey === s.key
            const Icon = s.key === 'B' ? Bell : s.key === 'C' ? XCircle : Utensils

            const btnCls =
              s.accent === 'orange'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : s.accent === 'amber'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-rose-600 hover:bg-rose-700 text-white'

            const badgeCls =
              s.accent === 'orange'
                ? 'border-orange-800 bg-orange-950/60 text-orange-300'
                : s.accent === 'amber'
                ? 'border-amber-800 bg-amber-950/60 text-amber-300'
                : 'border-rose-800 bg-rose-950/60 text-rose-300'

            return (
              <div
                key={s.key}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>
                      <Icon className="h-3 w-3" />
                      {s.badge}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">{s.windowMin} min TTL</span>
                  </div>

                  <h2 className="text-sm font-bold text-white">{s.title}</h2>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{s.subtitle}</p>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Item</span>
                      <span className="font-semibold text-slate-200 text-right">{s.item}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Pricing</span>
                      <span className="font-bold text-emerald-400">{s.priceLine}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Merchant POS</span>
                      <span className="font-medium text-orange-300 text-right">{s.partnerHint}</span>
                    </div>
                  </div>

                  <ol className="mt-4 space-y-1.5 text-[11px] text-slate-400 list-decimal list-inside">
                    {s.steps.map(step => (
                      <li key={step} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <button
                  type="button"
                  disabled={triggeringKey !== null}
                  onClick={() => void handleTrigger(s.key)}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${btnCls}`}
                >
                  {isTriggering ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {isTriggering ? `Triggering Scenario ${s.key}...` : `Trigger Scenario ${s.key}`}
                </button>
              </div>
            )
          })}
        </section>

        {/* Execution Output + Real-Time Telemetry */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Last execution & backend snapshot */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Server className="h-4 w-4 text-orange-400" />
                Backend &amp; Scenario Inspector
              </h2>
              <span className="text-[11px] font-mono text-slate-400">{API_BASE}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">API Status</div>
                <div className={`mt-1 text-sm font-black uppercase ${health?.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {health?.status ?? 'Offline'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Environment</div>
                <div className="mt-1 text-sm font-black text-slate-200">{health?.env ?? 'Unknown'}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live Deals</div>
                <div className="mt-1 text-sm font-black text-orange-400">{activeDeals.length}</div>
              </div>
            </div>

            {lastResult ? (
              <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Last Execution: {lastResult.name ?? lastResult.scenario}
                  </span>
                  <span className="rounded-md bg-emerald-900/70 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    Deal #{lastResult.deal_id} · {lastResult.discount_pct}% OFF
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  {lastResult.restaurant} — <span className="font-semibold text-white">{lastResult.item}</span>
                </div>
                <p className="text-[11px] text-slate-400 italic leading-relaxed">
                  Gemini Rationale: &ldquo;{lastResult.reasoning}&rdquo;
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                No scenario triggered in this session yet. Click Scenario A, B, or C above to inspect the backend dispatch payload.
              </div>
            )}
          </div>

          {/* Live SSE Telemetry Stream */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Activity className="h-4 w-4 text-emerald-400" />
                Live SSE Telemetry Stream
              </h2>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Radio className="h-3 w-3 text-emerald-400" />
                /sse/student/1
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                Awaiting SSE frames from backend event dispatcher...
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logs.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-500">{entry.timestamp}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-300">
                          {entry.eventType}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-300">{entry.summary}</div>
                    </div>
                    {entry.latencyMs !== null && (
                      <span className="shrink-0 rounded-full bg-emerald-950 border border-emerald-800 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                        {entry.latencyMs} ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
