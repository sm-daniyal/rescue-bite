import React, { useCallback, useEffect, useState } from 'react'
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
} from 'lucide-react'
import { api, type DashboardData, type Reservation } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { useSSE } from '../hooks/useSSE'

export interface RestaurantDashboardProps {
  initialRestaurantId?: number
  onRestaurantChange?: (restaurantId: number) => void
}

const SHIVAMOGGA_RESTAURANTS = [
  { id: 1, name: 'Hotel Samrat Ashok', cuisine: 'South Indian' },
  { id: 2, name: 'Sri Venkateshwara Grand', cuisine: 'South Indian' },
  { id: 3, name: 'Meenakshi Bhavan Darshini', cuisine: 'Darshini' },
  { id: 4, name: 'Hotel Jewel Rock', cuisine: 'North Indian' },
  { id: 5, name: 'Biryani Paradise', cuisine: 'North Indian' },
  { id: 6, name: 'Udupi Sri Krishna Sagar', cuisine: 'South Indian' },
  { id: 7, name: 'Sri Guru Darshini', cuisine: 'Darshini' },
  { id: 8, name: 'Malnad Kitchen', cuisine: 'South Indian' },
]

export const RestaurantDashboard: React.FC<RestaurantDashboardProps> = ({
  initialRestaurantId = 5, // Default to Biryani Paradise
  onRestaurantChange,
}) => {
  const [restaurantId, setRestaurantId] = useState<number>(initialRestaurantId)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null)
  const [rejectingReservationId, setRejectingReservationId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('item_unavailable')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Fetch dashboard data
  const loadDashboard = useCallback(async (id: number) => {
    try {
      setLoading(true)
      const res = await api.getRestaurantDashboard(id)
      setData(res)
    } catch {
      // Handle error gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard(restaurantId)
  }, [restaurantId, loadDashboard])

  // Real-time SSE integration for incoming reservations
  const sseUrl = `${API_BASE}/sse/restaurant/${restaurantId}`
  const { status: sseStatus } = useSSE(sseUrl, {
    onMessage: (event) => {
      if (event.type === 'new_reservation' && 'reservation' in event) {
        const newRes = event.reservation as Reservation
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            pending_reservations: [newRes, ...prev.pending_reservations],
          }
        })
        setMessage({ text: `New reservation #RB-${newRes.id} received!`, type: 'success' })
      } else if (event.type === 'reservation_update' && 'reservation' in event) {
        const updated = event.reservation as Reservation
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            pending_reservations: prev.pending_reservations.filter((r) => r.id !== updated.id),
            confirmed_reservations:
              updated.status === 'confirmed'
                ? [updated, ...prev.confirmed_reservations.filter((r) => r.id !== updated.id)]
                : prev.confirmed_reservations.filter((r) => r.id !== updated.id),
          }
        })
      }
    },
  })

  // Restaurant switch handler
  const handleSelectRestaurant = (id: number) => {
    setRestaurantId(id)
    onRestaurantChange?.(id)
  }

  // Confirm Reservation
  const handleConfirm = async (resId: number) => {
    try {
      setActionInProgressId(resId)
      const confirmed = await api.confirmReservation(resId)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          pending_reservations: prev.pending_reservations.filter((r) => r.id !== resId),
          confirmed_reservations: [confirmed, ...prev.confirmed_reservations],
        }
      })
      setMessage({ text: `Reservation #RB-${resId} confirmed!`, type: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed'
      setMessage({ text: msg, type: 'error' })
    } finally {
      setActionInProgressId(null)
    }
  }

  // Reject Reservation
  const handleReject = async (resId: number) => {
    try {
      setActionInProgressId(resId)
      await api.rejectReservation(resId, rejectReason)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          pending_reservations: prev.pending_reservations.filter((r) => r.id !== resId),
        }
      })
      setRejectingReservationId(null)
      setMessage({ text: `Reservation #RB-${resId} rejected (${rejectReason})`, type: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed'
      setMessage({ text: msg, type: 'error' })
    } finally {
      setActionInProgressId(null)
    }
  }

  // Complete Reservation (Mark Picked Up)
  const handleComplete = async (resId: number) => {
    try {
      setActionInProgressId(resId)
      await api.completeReservation(resId)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          confirmed_reservations: prev.confirmed_reservations.filter((r) => r.id !== resId),
        }
      })
      setMessage({ text: `Reservation #RB-${resId} marked complete! Meal rescued.`, type: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Completion failed'
      setMessage({ text: msg, type: 'error' })
    } finally {
      setActionInProgressId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      {/* ── Partner Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Store className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-stone-900">Partner Ops Dashboard</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                sseStatus === 'live'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              ● {sseStatus}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Real-time surplus deal publication & counter reservation queue
          </p>
        </div>

        {/* Restaurant Selector & Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={restaurantId}
            onChange={(e) => handleSelectRestaurant(Number(e.target.value))}
            className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 focus:border-orange-500 focus:outline-hidden"
          >
            {SHIVAMOGGA_RESTAURANTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.cuisine})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadDashboard(restaurantId)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Status Message Toast ────────────────────────────────────────── */}
      {message && (
        <div
          className={`mt-4 rounded-xl p-3 text-xs font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-[11px] font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Key Metrics Bar ─────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-3 text-center">
          <span className="text-[11px] font-medium text-stone-500">Active Deals</span>
          <p className="text-xl font-black text-stone-900">{data?.active_deals.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-stone-100 bg-orange-50/80 p-3 text-center">
          <span className="text-[11px] font-medium text-orange-700">Pending Holds</span>
          <p className="text-xl font-black text-orange-600">{data?.pending_reservations.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-stone-100 bg-emerald-50/80 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-700">
            <Shield className="h-3 w-3" />
            <span>Reliability</span>
          </div>
          <p className="text-xl font-black text-emerald-700">
            {Math.round((data?.restaurant.reliability_score ?? 0.95) * 100)}%
          </p>
        </div>
      </div>

      {/* ── Pending Reservations Section (Action Required) ──────────────── */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
            <ShoppingBag className="h-4 w-4 text-orange-600" />
            <span>Incoming Student Reservations ({data?.pending_reservations.length ?? 0})</span>
          </h3>
          <span className="text-[11px] text-stone-400">10-min confirmation SLA</span>
        </div>

        {data?.pending_reservations.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-400">
            No pending reservations right now. New student bookings appear here via live SSE.
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {data?.pending_reservations.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">Hold #RB-{res.id}</span>
                    <span className="rounded-md bg-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                      Qty: {res.quantity}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      Pickup deadline: {new Date(res.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Confirm & Reject Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionInProgressId === res.id}
                    onClick={() => handleConfirm(res.id)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Confirm
                  </button>

                  <button
                    type="button"
                    disabled={actionInProgressId === res.id}
                    onClick={() => setRejectingReservationId(res.id)}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reject Reason Modal / Inline Selector ────────────────────────── */}
      {rejectingReservationId && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>Reject Reservation #RB-{rejectingReservationId}</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-700">
            Select an auditable reason code for Swiggy partner reliability tracking:
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800"
            >
              <option value="item_unavailable">Item sold out at counter</option>
              <option value="quantity_reduced">Portion shortage</option>
              <option value="kitchen_closed">Kitchen shift ended</option>
              <option value="other">Other operational reason</option>
            </select>

            <button
              type="button"
              disabled={actionInProgressId === rejectingReservationId}
              onClick={() => handleReject(rejectingReservationId)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
            >
              Confirm Rejection
            </button>
            <button
              type="button"
              onClick={() => setRejectingReservationId(null)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmed Reservations Queue (Ready for Pickup) ─────────────── */}
      <div className="mt-6 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-bold text-stone-900">
          Confirmed for Counter Pickup ({data?.confirmed_reservations.length ?? 0})
        </h3>

        {data?.confirmed_reservations.length === 0 ? (
          <p className="mt-2 text-xs text-stone-400 italic">No confirmed reservations pending pickup.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data?.confirmed_reservations.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-800">Reservation #RB-{r.id}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Confirmed
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    Student pay at pickup: Cash/UPI
                  </span>
                </div>

                <button
                  type="button"
                  disabled={actionInProgressId === r.id}
                  onClick={() => handleComplete(r.id)}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  Mark Complete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active Flash Deals ──────────────────────────────────────────── */}
      <div className="mt-6 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-bold text-stone-900">
          Currently Published Deals ({data?.active_deals.length ?? 0})
        </h3>
        <div className="mt-3 space-y-2">
          {data?.active_deals.map((deal) => (
            <div
              key={deal.id}
              className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-xs"
            >
              <div>
                <span className="font-bold text-stone-800">{deal.item?.name ?? 'Surplus Package'}</span>
                <div className="flex items-center gap-2 text-stone-500 text-[11px]">
                  <span>Discount: {deal.discount_pct}%</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    <Sparkles className="h-3 w-3" />
                    AI Pricing
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 font-semibold text-stone-600">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
