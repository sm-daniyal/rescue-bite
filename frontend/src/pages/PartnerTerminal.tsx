/**
 * PartnerTerminal — the restaurant merchant POS page at route "/partner".
 *
 * Layout: full-width counter terminal, optimised for tablet / desktop monitors.
 * Zero student browsing UI. Zero emojis.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  Check,
  X,
  Clock,
  Shield,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { api, type DashboardData, type Reservation } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { useSSE } from '../hooks/useSSE'

const RESTAURANTS = [
  { id: 1, name: 'Hotel Samrat Ashok',       cuisine: 'South Indian' },
  { id: 2, name: 'Sri Venkateshwara Grand',   cuisine: 'South Indian' },
  { id: 3, name: 'Meenakshi Bhavan Darshini', cuisine: 'Darshini'     },
  { id: 4, name: 'Hotel Jewel Rock',          cuisine: 'North Indian' },
  { id: 5, name: 'Biryani Paradise',          cuisine: 'North Indian' },
  { id: 6, name: 'Udupi Sri Krishna Sagar',   cuisine: 'South Indian' },
  { id: 7, name: 'Sri Guru Darshini',         cuisine: 'Darshini'     },
  { id: 8, name: 'Malnad Kitchen',            cuisine: 'South Indian' },
]

const REJECT_REASONS: { value: string; label: string }[] = [
  { value: 'item_unavailable',  label: 'Item sold out at counter'  },
  { value: 'quantity_reduced',  label: 'Portion shortage'          },
  { value: 'kitchen_closed',    label: 'Kitchen shift ended'       },
  { value: 'other',             label: 'Other operational reason'  },
]

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'live' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
    : status === 'reconnecting' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/30'
    : 'bg-slate-500/10 text-slate-400 ring-slate-500/30'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-emerald-400 animate-pulse' : status === 'reconnecting' ? 'bg-amber-400' : 'bg-slate-500'}`} />
      {status}
    </span>
  )
}

function MetricCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className={`rounded-2xl p-5 ${accent}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-slate-400">{sub}</div>}
    </div>
  )
}

export function PartnerTerminal() {
  const [restaurantId, setRestaurantId] = useState(5)
  const [data, setData]                 = useState<DashboardData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [actionId, setActionId]         = useState<number | null>(null)
  const [rejectId, setRejectId]         = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('item_unavailable')
  const [flash, setFlash]               = useState<{ text: string; ok: boolean } | null>(null)

  const notify = (text: string, ok = true) => {
    setFlash({ text, ok })
    setTimeout(() => setFlash(null), 4000)
  }

  const load = useCallback(async (id: number) => {
    try {
      setLoading(true)
      setFetchError(null)
      setData(await api.getRestaurantDashboard(id))
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Unable to connect to merchant API')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(restaurantId) }, [restaurantId, load])

  const { status: sseStatus } = useSSE(`${API_BASE}/sse/restaurant/${restaurantId}`, {
    onMessage: event => {
      if (event.type === 'new_reservation' && 'reservation' in event) {
        const r = event.reservation as Reservation
        setData(prev => prev ? {
          ...prev,
          pending_reservations: [r, ...prev.pending_reservations.filter(x => x.id !== r.id)],
        } : prev)
        notify(`New reservation #RB-${r.id} arrived`)
      } else if (event.type === 'reservation_update' && 'reservation' in event) {
        const r = event.reservation as Reservation
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            pending_reservations: prev.pending_reservations.filter(x => x.id !== r.id),
            confirmed_reservations:
              r.status === 'confirmed'
                ? [r, ...prev.confirmed_reservations.filter(x => x.id !== r.id)]
                : prev.confirmed_reservations.filter(x => x.id !== r.id),
          }
        })
      }
    },
  })

  const handleConfirm = async (id: number) => {
    try {
      setActionId(id)
      const confirmed = await api.confirmReservation(id)
      setData(prev => prev ? {
        ...prev,
        pending_reservations: prev.pending_reservations.filter(r => r.id !== id),
        confirmed_reservations: [confirmed, ...prev.confirmed_reservations],
      } : prev)
      notify(`Hold #RB-${id} confirmed`)
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Confirm failed', false)
    } finally { setActionId(null) }
  }

  const handleReject = async (id: number) => {
    try {
      setActionId(id)
      await api.rejectReservation(id, rejectReason)
      setData(prev => prev ? { ...prev, pending_reservations: prev.pending_reservations.filter(r => r.id !== id) } : prev)
      setRejectId(null)
      notify(`Hold #RB-${id} rejected (${rejectReason})`)
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Reject failed', false)
    } finally { setActionId(null) }
  }

  const handleComplete = async (id: number) => {
    try {
      setActionId(id)
      await api.completeReservation(id)
      setData(prev => prev ? { ...prev, confirmed_reservations: prev.confirmed_reservations.filter(r => r.id !== id) } : prev)
      notify(`Hold #RB-${id} marked complete — meal rescued`)
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Complete failed', false)
    } finally { setActionId(null) }
  }

  const restaurant = RESTAURANTS.find(r => r.id === restaurantId)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white font-sans">
      {/* Top chrome bar */}
      <header className="border-b border-white/[0.06] bg-[#161922] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fc8019] shadow-lg shadow-orange-900/30">
            <Zap className="h-5 w-5 text-white fill-white" />
          </div>
          <div>
            <div className="text-[14px] font-extrabold text-white tracking-tight">
              Swiggy <span className="text-[#fc8019]">Rescue</span>
            </div>
            <div className="text-[11px] text-slate-500">Partner Merchant Terminal</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={sseStatus} />
          <select
            value={restaurantId}
            onChange={e => setRestaurantId(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-medium text-slate-200 focus:border-[#fc8019] focus:outline-none focus:ring-1 focus:ring-[#fc8019]/30 min-h-[40px]"
          >
            {RESTAURANTS.map(r => (
              <option key={r.id} value={r.id}>{r.name} — {r.cuisine}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load(restaurantId)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors min-h-[40px]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Student App
          </Link>
        </div>
      </header>

      {/* Flash message */}
      {flash && (
        <div className={`mx-4 sm:mx-6 mt-4 rounded-xl px-4 py-3 text-[13px] font-semibold flex items-center justify-between ${
          flash.ok ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'
        }`}>
          {flash.text}
          <button type="button" onClick={() => setFlash(null)} className="hover:underline text-[12px]">Dismiss</button>
        </div>
      )}

      {fetchError && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20 px-4 py-3 text-[13px] text-rose-300 flex items-center justify-between gap-3">
          <span>Connection error: {fetchError}</span>
          <button
            type="button"
            onClick={() => load(restaurantId)}
            className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-rose-700 shrink-0 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Restaurant title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <Store className="h-5 w-5 text-[#fc8019]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">{restaurant?.name ?? 'Partner Outlet'}</h1>
              <span className="text-[12px] text-slate-500">{restaurant?.cuisine} — Real-time counter reservation queue</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Active Deals"
            value={data?.active_deals.length ?? 0}
            sub="live in student feed"
            icon={Sparkles}
            accent="bg-white/[0.03] ring-1 ring-white/[0.06] rounded-2xl"
          />
          <MetricCard
            label="Pending Holds"
            value={data?.pending_reservations.length ?? 0}
            sub="awaiting your confirmation"
            icon={ShoppingBag}
            accent="bg-[#fc8019]/5 ring-1 ring-[#fc8019]/20 rounded-2xl"
          />
          <MetricCard
            label="Reliability"
            value={`${Math.round((data?.restaurant.reliability_score ?? 0.95) * 100)}%`}
            sub="deal completion rate"
            icon={TrendingUp}
            accent="bg-emerald-500/5 ring-1 ring-emerald-500/20 rounded-2xl"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Pending queue (action required) ─────────────────────────── */}
          <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fc8019]/10">
                  <ShoppingBag className="h-4 w-4 text-[#fc8019]" />
                </div>
                Incoming Student Holds
                <span className="rounded-full bg-[#fc8019] px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {data?.pending_reservations.length ?? 0}
                </span>
              </h2>
              <span className="text-[12px] text-slate-500 font-medium">10-min confirm SLA</span>
            </div>

            {!data || data.pending_reservations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-[13px] text-slate-500">
                No pending holds. New student reservations appear here instantly via SSE.
              </div>
            ) : (
              <div className="space-y-3">
                {data.pending_reservations.map(res => (
                  <div key={res.id} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="text-[14px] font-bold text-white">Hold #RB-{res.id}</span>
                          <span className="rounded-lg bg-[#fc8019]/15 ring-1 ring-[#fc8019]/30 px-2 py-0.5 text-[11px] font-bold text-[#fc8019]">
                            Qty: {res.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          Pickup deadline: {new Date(res.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {rejectId === res.id ? null : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={actionId === res.id}
                            onClick={() => handleConfirm(res.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all min-h-[40px]"
                          >
                            <Check className="h-4 w-4" />
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={actionId === res.id}
                            onClick={() => setRejectId(res.id)}
                            className="flex items-center gap-1.5 rounded-xl ring-1 ring-white/10 px-4 py-2 text-[13px] font-semibold text-rose-400 hover:bg-white/5 disabled:opacity-50 min-h-[40px] transition-colors"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reject reason inline */}
                    {rejectId === res.id && (
                      <div className="mt-3 rounded-xl bg-rose-500/5 ring-1 ring-rose-500/20 p-3.5">
                        <div className="flex items-center gap-1.5 text-[13px] font-bold text-rose-400 mb-2.5">
                          <AlertCircle className="h-4 w-4" />
                          Select rejection reason
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <select
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/30"
                          >
                            {REJECT_REASONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={actionId === res.id}
                            onClick={() => handleReject(res.id)}
                            className="rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectId(null)}
                            className="rounded-xl px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Confirmed — awaiting pickup */}
            <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] p-5">
              <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                Confirmed — Awaiting Pickup
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  {data?.confirmed_reservations.length ?? 0}
                </span>
              </h2>

              {!data || data.confirmed_reservations.length === 0 ? (
                <p className="text-[13px] text-slate-500">No holds confirmed yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.confirmed_reservations.map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3.5">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[13px] font-bold text-white">Hold #RB-{r.id}</span>
                          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">Confirmed</span>
                        </div>
                        <span className="text-[12px] text-slate-400">Counter pay — Cash / UPI</span>
                      </div>
                      <button
                        type="button"
                        disabled={actionId === r.id}
                        onClick={() => handleComplete(r.id)}
                        className="rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-slate-900 hover:bg-[#fc8019] hover:text-white disabled:opacity-50 transition-colors min-h-[40px]"
                      >
                        Mark Picked Up
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active deals */}
            <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] p-5">
              <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fc8019]/10">
                  <Sparkles className="h-4 w-4 text-[#fc8019]" />
                </div>
                Live Deals in Student Feed
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                  {data?.active_deals.length ?? 0}
                </span>
              </h2>

              {!data || data.active_deals.length === 0 ? (
                <p className="text-[13px] text-slate-500">No active deals. Deals are created by the surplus engine automatically.</p>
              ) : (
                <div className="space-y-3">
                  {data.active_deals.map(deal => {
                    const basePrice = deal.item?.base_price
                    const discounted = basePrice !== undefined ? Math.round(basePrice * (1 - deal.discount_pct / 100)) : null
                    return (
                      <div key={deal.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3.5">
                        <div>
                          <span className="text-[13px] font-bold text-white">{deal.item?.name ?? 'Surplus Package'}</span>
                          <div className="flex items-center gap-2 text-[12px] text-slate-400 mt-0.5">
                            {discounted !== null && (
                              <>
                                <span className="font-semibold text-slate-200">₹{discounted}</span>
                                <span>|</span>
                              </>
                            )}
                            <span>{deal.discount_pct}% off</span>
                            <span>|</span>
                            <span className="flex items-center gap-1 text-[#fc8019]">
                              <Sparkles className="h-3 w-3" />
                              AI pricing
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400 uppercase">
                          Active
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Reliability */}
            <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] p-5">
              <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                Partner Reliability Score
              </h2>
              <div className="text-4xl font-black text-emerald-400 mt-2">
                {Math.round((data?.restaurant.reliability_score ?? 0.95) * 100)}%
              </div>
              <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
                Restaurants below 80% are deprioritised in the student feed ranking. Reject with valid reason codes to maintain your score.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
