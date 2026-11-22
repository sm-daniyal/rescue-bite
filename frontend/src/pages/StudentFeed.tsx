import React, { useState } from 'react'
import {
  MapPin,
  RefreshCw,
  Sparkles,
  Leaf,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import { useDeals } from '../hooks/useDeals'
import { useSSE } from '../hooks/useSSE'
import { api, type Reservation } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { DealCard } from '../components/DealCard'
import { BreakBellToast } from '../components/BreakBellToast'

export interface StudentFeedProps {
  studentId?: number
  studentName?: string
}

export const StudentFeed: React.FC<StudentFeedProps> = ({
  studentId = 1,
  studentName = 'Rahul Sharma',
}) => {
  const { deals, loading, error, connectionStatus, refreshDeals } = useDeals({ studentId })
  const [filterVegOnly, setFilterVegOnly] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Reservation state
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null)
  const [reservingDealId, setReservingDealId] = useState<number | null>(null)
  const [reservationError, setReservationError] = useState<string | null>(null)

  // Break Bell Toast state
  const [breakBellOpen, setBreakBellOpen] = useState(false)
  const [breakBellDealsCount, setBreakBellDealsCount] = useState(0)

  // Listen for direct student reservation updates & break bell via SSE
  const sseUrl = `${API_BASE}/sse/student/${studentId}`
  useSSE(sseUrl, {
    onMessage: (event) => {
      if (event.type === 'break_bell' && 'deals' in event) {
        setBreakBellDealsCount(event.deals.length)
        setBreakBellOpen(true)
      } else if (event.type === 'reservation_update' && 'reservation' in event) {
        setActiveReservation(event.reservation)
      }
    },
  })

  // Filter deals
  const categories = ['all', 'Meals', 'Biryani', 'Snacks', 'Breakfast', 'Combos']
  const filteredDeals = deals.filter((deal) => {
    if (filterVegOnly && !deal.item?.is_vegetarian) return false
    if (selectedCategory !== 'all' && deal.item?.category !== selectedCategory) return false
    return true
  })

  // Handle reserve click
  const handleReserve = async (dealId: number) => {
    try {
      setReservingDealId(dealId)
      setReservationError(null)
      const res = await api.createReservation({
        flash_deal_id: dealId,
        student_id: studentId,
        quantity: 1,
      })
      setActiveReservation(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reservation'
      setReservationError(msg)
    } finally {
      setReservingDealId(null)
    }
  }

  // Calculate cumulative stats for JNNCE student
  const totalPortionsSaved = deals.length > 0 ? 34 : 0
  const co2AvoidedKg = Math.round(totalPortionsSaved * 2.5)

  return (
    <div className="min-h-screen bg-stone-50/60 pb-16">
      {/* ── Break Bell Toast Notification ─────────────────────────────────── */}
      <BreakBellToast
        open={breakBellOpen}
        onOpenChange={setBreakBellOpen}
        dealCount={breakBellDealsCount || deals.length}
        breakLabel="Lunch Break (1:00 PM)"
      />

      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          {/* Brand & Location */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md shadow-orange-600/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-stone-900">
                  Swiggy <span className="text-orange-600">Campus Rescue</span>
                </h1>
                <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                  Prototype
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <MapPin className="h-3 w-3 text-orange-600" />
                <span>JNNCE Campus centroid (Shivamogga)</span>
              </div>
            </div>
          </div>

          {/* SSE Live Connection Status & User Pill */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                connectionStatus === 'live'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
              title={`Connection status: ${connectionStatus}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'live'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              <span className="capitalize">{connectionStatus}</span>
            </div>

            <button
              type="button"
              onClick={() => refreshDeals()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
              title="Refresh deals"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 pt-6">
        {/* Prototype & ESG Mission Banner */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 p-5 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-xs">
                <Leaf className="h-3.5 w-3.5 text-emerald-300" />
                Student Food Rescue Mission
              </span>
              <h2 className="mt-2 text-xl font-bold tracking-tight">
                Hey {studentName}! Surplus food deals near college.
              </h2>
              <p className="mt-1 text-xs text-orange-100 max-w-xl leading-relaxed">
                Restaurants near JNNCE prepare surplus for peak hours. Connect with deals at{' '}
                <span className="font-bold text-white">35%–65% OFF</span> timed exactly to campus break bells.
              </p>
            </div>

            {/* Impact Metric Chips */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-xs">
                <div className="text-lg font-black text-white">{deals.length}</div>
                <div className="text-[10px] text-orange-100 uppercase font-semibold">Active Deals</div>
              </div>
              <div className="rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-xs">
                <div className="text-lg font-black text-white">~{co2AvoidedKg} kg</div>
                <div className="text-[10px] text-orange-100 uppercase font-semibold">CO₂ Avoided</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Reservation Banner (if student reserved a deal) ────────── */}
        {activeReservation && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  {activeReservation.status === 'confirmed' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : activeReservation.status === 'rejected' ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5 animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900">
                      Active Reservation #RB-{activeReservation.id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        activeReservation.status === 'confirmed'
                          ? 'bg-emerald-600 text-white'
                          : activeReservation.status === 'rejected'
                          ? 'bg-rose-600 text-white'
                          : activeReservation.status === 'completed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {activeReservation.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-800">
                    {activeReservation.status === 'pending' &&
                      'Waiting for restaurant partner confirmation. Hold window: 30 minutes.'}
                    {activeReservation.status === 'confirmed' &&
                      `Confirmed! Show Reservation #RB-${activeReservation.id} at the counter. Pay via Cash/UPI on pickup.`}
                    {activeReservation.status === 'rejected' &&
                      `Reservation rejected: ${activeReservation.rejection_reason ?? 'Item sold out'}.`}
                    {activeReservation.status === 'completed' &&
                      'Completed! Meal rescued. Thanks for reducing campus food waste!'}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">
                    Pickup Deadline: {new Date(activeReservation.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {activeReservation.status === 'completed' || activeReservation.status === 'rejected' ? (
                <button
                  type="button"
                  onClick={() => setActiveReservation(null)}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Error notification banner if reservation failed */}
        {reservationError && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center justify-between">
            <span>{reservationError}</span>
            <button
              type="button"
              onClick={() => setReservationError(null)}
              className="text-xs font-bold hover:underline"
            >
              Close
            </button>
          </div>
        )}

        {/* ── Filter Bar ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Veg Only Toggle */}
          <button
            type="button"
            onClick={() => setFilterVegOnly(!filterVegOnly)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              filterVegOnly
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full border border-emerald-600 ${
                filterVegOnly ? 'bg-emerald-600' : 'bg-transparent'
              }`}
            />
            Veg Only
          </button>
        </div>

        {/* ── Deals Grid ──────────────────────────────────────────────────── */}
        {loading && deals.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 animate-spin">
              <RefreshCw className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-700">Loading campus flash deals...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => refreshDeals()}
              className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-stone-900">
              No active surplus deals right now
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-stone-500 leading-relaxed">
              Restaurants publish surplus deals around campus break times. Next break bell window:{' '}
              <span className="font-semibold text-stone-700">1:00 PM – 2:00 PM (Lunch Break)</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onReserve={handleReserve}
                isReserving={reservingDealId === deal.id}
                isReserved={activeReservation?.flash_deal_id === deal.id}
              />
            ))}
          </div>
        )}

        {/* ── Footer / Trust Badges ───────────────────────────────────────── */}
        <footer className="mt-12 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-orange-600" />
              <span>Verified Swiggy Restaurant Partners</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <span>Zero Food Waste Initiative</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-stone-400">
            RescueBite Prototype for Swiggy Food for Thought 2.0 (2026–27) • Built for JNNCE, Shivamogga
          </p>
        </footer>
      </main>
    </div>
  )
}
