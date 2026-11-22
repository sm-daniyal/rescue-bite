import React, { useMemo, useState } from 'react'
import {
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
import { Sidebar, type NavTab } from '../components/Sidebar'
import { TopNavbar } from '../components/TopNavbar'
import { BreakTimelineBar } from '../components/BreakTimelineBar'
import { DealCard } from '../components/DealCard'
import { BreakBellToast } from '../components/BreakBellToast'

export interface StudentFeedProps {
  studentId?: number
  studentName?: string
  isCompact?: boolean
}

const SHIVAMOGGA_PARTNERS = [
  {
    id: 1,
    name: 'Hotel Samrat Ashok',
    cuisine: 'South Indian & Thalis',
    distanceKm: 2.1,
    reliability: 98,
    activeSpecials: 'South Indian Thali',
  },
  {
    id: 2,
    name: 'Sri Venkateshwara Grand',
    cuisine: 'South Indian & Fast Food',
    distanceKm: 2.8,
    reliability: 96,
    activeSpecials: 'Masala Dosa, Filter Coffee',
  },
  {
    id: 3,
    name: 'Meenakshi Bhavan Darshini',
    cuisine: 'Darshini Quick Service',
    distanceKm: 3.2,
    reliability: 97,
    activeSpecials: 'Idli-Vada Combo, Mangalore Buns',
  },
  {
    id: 4,
    name: 'Hotel Jewel Rock',
    cuisine: 'North Indian & Mughlai',
    distanceKm: 3.9,
    reliability: 94,
    activeSpecials: 'Paneer Butter Masala',
  },
  {
    id: 5,
    name: 'Biryani Paradise',
    cuisine: 'Hyderabadi & Biryani',
    distanceKm: 4.1,
    reliability: 99,
    activeSpecials: 'Dum Biryani, Chicken Kabab',
  },
  {
    id: 6,
    name: 'Udupi Sri Krishna Sagar',
    cuisine: 'Pure Veg & Udupi Tiffin',
    distanceKm: 2.4,
    reliability: 95,
    activeSpecials: 'Set Dosa, Chow-Chow Bath',
  },
  {
    id: 7,
    name: 'Sri Guru Darshini',
    cuisine: 'Darshini & Beverages',
    distanceKm: 1.8,
    reliability: 96,
    activeSpecials: 'Rava Idli, Khara Bath',
  },
  {
    id: 8,
    name: 'Malnad Kitchen',
    cuisine: 'Malnad Regional Specials',
    distanceKm: 4.5,
    reliability: 93,
    activeSpecials: 'Malnad Veg Meals, Akki Roti',
  },
]

export const StudentFeed: React.FC<StudentFeedProps> = ({
  studentId = 1,
  studentName = 'Rahul Sharma',
  isCompact = false,
}) => {
  const { deals, loading, error, connectionStatus, refreshDeals } = useDeals({ studentId })
  const [activeTab, setActiveTab] = useState<NavTab>('deals')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterVegOnly, setFilterVegOnly] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(1) // Default: Lunch Break

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
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (filterVegOnly && !deal.item?.is_vegetarian) return false
      if (selectedCategory !== 'all' && deal.item?.category !== selectedCategory) return false
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase()
        const itemName = deal.item?.name.toLowerCase() ?? ''
        const restaurantName = deal.restaurant?.name.toLowerCase() ?? ''
        const category = deal.item?.category.toLowerCase() ?? ''
        if (!itemName.includes(query) && !restaurantName.includes(query) && !category.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [deals, filterVegOnly, selectedCategory, searchQuery])

  // Partition deals into 3 columns matching reference meal plan dashboard
  // Column 1: Morning Break / Breakfast & Tiffin (or Veg / Light)
  // Column 2: Lunch Break / Meals & Biryani
  // Column 3: Evening Break / Snacks & Beverages
  const categorizedColumns = useMemo(() => {
    const col1 = filteredDeals.filter(
      (d) =>
        d.item?.category === 'Breakfast' ||
        d.item?.name.toLowerCase().includes('dosa') ||
        d.item?.name.toLowerCase().includes('idli')
    )
    const col2 = filteredDeals.filter(
      (d) =>
        d.item?.category === 'Meals' ||
        d.item?.category === 'Biryani' ||
        d.item?.name.toLowerCase().includes('biryani') ||
        d.item?.name.toLowerCase().includes('thali')
    )
    const col3 = filteredDeals.filter(
      (d) =>
        d.item?.category === 'Snacks' ||
        d.item?.category === 'Combos' ||
        (!col1.includes(d) && !col2.includes(d))
    )

    // Fallback: If any column is empty while deals exist, balance them across columns
    if (col1.length === 0 && col2.length === 0 && col3.length === 0 && filteredDeals.length > 0) {
      const perCol = Math.ceil(filteredDeals.length / 3)
      return {
        morning: filteredDeals.slice(0, perCol),
        lunch: filteredDeals.slice(perCol, perCol * 2),
        evening: filteredDeals.slice(perCol * 2),
      }
    }

    return {
      morning: col1.length > 0 ? col1 : filteredDeals.slice(0, 2),
      lunch: col2.length > 0 ? col2 : filteredDeals.slice(2, 4),
      evening: col3.length > 0 ? col3 : filteredDeals.slice(4),
    }
  }, [filteredDeals])

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

  // JNNCE campus impact statistics
  const totalPortionsSaved = deals.length > 0 ? 38 : 0
  const co2AvoidedKg = Math.round(totalPortionsSaved * 2.5)
  const studentSavingsTotal = totalPortionsSaved * 55

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* ── Toast Notification: Break Bell (Zero emojis) ─────────────────── */}
      <BreakBellToast
        open={breakBellOpen}
        onOpenChange={setBreakBellOpen}
        dealCount={breakBellDealsCount || deals.length}
        breakLabel="Lunch Break (13:00 – 14:00)"
      />

      {/* ── Left Sidebar (Full desktop, collapsed or hidden in compact split) ── */}
      {!isCompact && (
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeReservationsCount={activeReservation ? 1 : 0}
          connectionStatus={connectionStatus}
        />
      )}

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <TopNavbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          studentName={studentName}
          department="BE Computer Science • JNNCE"
          activeBreakLabel="Lunch Break Window (13:00 – 14:00)"
          dealCount={deals.length}
        />

        <main className="p-6 max-w-7xl mx-auto w-full">
          {/* Active Reservation Banner */}
          {activeReservation && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-xs">
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
                      <span className="text-xs font-bold text-emerald-950">
                        Active Reservation #RB-{activeReservation.id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
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
                    <p className="mt-1 text-xs text-emerald-900 leading-relaxed">
                      {activeReservation.status === 'pending' &&
                        'Reservation transmitted to partner counter. Awaiting confirmation (10-min SLA).'}
                      {activeReservation.status === 'confirmed' &&
                        `Confirmed by merchant! Show Reservation #RB-${activeReservation.id} at the pickup counter. Pay via Cash or UPI.`}
                      {activeReservation.status === 'rejected' &&
                        `Reservation unavailable: ${activeReservation.rejection_reason ?? 'Sold out at counter'}.`}
                      {activeReservation.status === 'completed' &&
                        'Order complete! Surplus meal rescued. Thank you for contributing to zero campus food waste.'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-800">
                      Pickup Window Deadline:{' '}
                      {new Date(activeReservation.pickup_deadline).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {activeReservation.status === 'completed' || activeReservation.status === 'rejected' ? (
                  <button
                    type="button"
                    onClick={() => setActiveReservation(null)}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Reservation Error Banner */}
          {reservationError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
              <span>{reservationError}</span>
              <button
                type="button"
                onClick={() => setReservationError(null)}
                className="text-xs font-bold text-rose-900 hover:underline"
              >
                Close
              </button>
            </div>
          )}

          {/* ── Subheader Title Area ─────────────────────────────────────── */}
          <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Surplus Distress Marketplace
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                JNNCE Break Window Deals
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Dynamic pricing calibrated by Gemini Flash 1.5 to college timetable intervals.
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{deals.length} Active Deals</span>
              </span>

              <button
                type="button"
                onClick={() => refreshDeals()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* ── Break Timeline Bar ───────────────────────────────────────── */}
          <BreakTimelineBar
            activeSlotIndex={activeSlotIndex}
            onSelectSlot={(slot) => setActiveSlotIndex(slot)}
          />

          {/* ── TAB 1: Live Flash Deals View (Desktop 3-Column Layout) ───── */}
          {activeTab === 'deals' && (
            <div>
              {/* Category Filter Controls */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    filterVegOnly
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full border border-emerald-600 ${
                      filterVegOnly ? 'bg-emerald-600' : 'bg-transparent'
                    }`}
                  />
                  <span>Vegetarian Only</span>
                </button>
              </div>

              {/* Deals Content */}
              {loading && deals.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 animate-spin">
                    <Clock className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Connecting to JNNCE surplus stream...
                  </p>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <UtensilsCrossed className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">
                    No active surplus deals matching criteria
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
                    Deals publish dynamically before each campus break bell. Select a different filter or check back during the next break interval.
                  </p>
                </div>
              ) : (
                /* 3-Column Structured Layout (Inspired by user's reference image) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Column 1: Morning Break / Breakfast Tiffins */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Morning Tiffin
                        </h3>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {categorizedColumns.morning.length} deals
                      </span>
                    </div>

                    <div className="space-y-3">
                      {categorizedColumns.morning.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onReserve={handleReserve}
                          isReserving={reservingDealId === deal.id}
                          isReserved={activeReservation?.flash_deal_id === deal.id}
                        />
                      ))}
                      {categorizedColumns.morning.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                          Window cleared for today.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Lunch Break / Meals & Biryani (Active Now) */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-orange-900">
                          Lunch Break (Active Now)
                        </h3>
                      </div>
                      <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                        Peak Clearance
                      </span>
                    </div>

                    <div className="space-y-3">
                      {categorizedColumns.lunch.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onReserve={handleReserve}
                          isReserving={reservingDealId === deal.id}
                          isReserved={activeReservation?.flash_deal_id === deal.id}
                        />
                      ))}
                      {categorizedColumns.lunch.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                          No active lunch deals right now.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Evening Break / Snacks & Combos */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Evening Snacks
                        </h3>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {categorizedColumns.evening.length} deals
                      </span>
                    </div>

                    <div className="space-y-3">
                      {categorizedColumns.evening.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onReserve={handleReserve}
                          isReserving={reservingDealId === deal.id}
                          isReserved={activeReservation?.flash_deal_id === deal.id}
                        />
                      ))}
                      {categorizedColumns.evening.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                          Scheduled for 16:30 IST.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Break Windows Timetable ───────────────────────────── */}
          {activeTab === 'schedule' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">JNNCE Academic Timetable Alignment</h3>
              <p className="mt-1 text-xs text-slate-500">
                RescueBite deals open 15 minutes before the bell rings, giving students sufficient time to reserve and walk or drive to the counter.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Slot 1: Morning Break</span>
                      <p className="text-xs text-slate-500">10:30 – 10:45 AM (15 mins window)</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Tiffin Clearance
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Participating Outlets: Hotel Samrat Ashok, Sri Venkateshwara Grand, Udupi Sri Krishna Sagar
                  </div>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Slot 2: Lunch Break (Primary Window)</span>
                      <p className="text-xs text-slate-500">13:00 – 14:00 PM (60 mins window)</p>
                    </div>
                    <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-bold text-white">
                      Active Window
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Participating Outlets: Biryani Paradise, Hotel Jewel Rock, Malnad Kitchen, Samrat Ashok
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Slot 3: Evening Break</span>
                      <p className="text-xs text-slate-500">16:30 – 16:45 PM (15 mins window)</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
                      Snack Clearance
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Participating Outlets: Meenakshi Bhavan Darshini, Sri Guru Darshini
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: My Reservations View ──────────────────────────────── */}
          {activeTab === 'reservations' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">My Food Rescue Holds</h3>
              <p className="mt-1 text-xs text-slate-500">
                Track your active counter holds and past meal pickups.
              </p>

              {activeReservation ? (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        Reservation #RB-{activeReservation.id}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Quantity: {activeReservation.quantity} portion • Payment mode: Counter Pay (Cash / UPI)
                      </div>
                      <div className="text-xs font-semibold text-emerald-700 mt-1">
                        Pickup Deadline:{' '}
                        {new Date(activeReservation.pickup_deadline).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white uppercase">
                      {activeReservation.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center text-xs text-slate-400 py-12">
                  <UtensilsCrossed className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  No active reservations. Pick any live flash deal to reserve your portion.
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: Partner Outlets View ──────────────────────────────── */}
          {activeTab === 'partners' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Shivamogga Restaurant Partners ({SHIVAMOGGA_PARTNERS.length})
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Verified outlets within 5.0 km JNNCE centroid participating in the surplus food rescue network.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-semibold">
                  100% Food Safety Verified
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {SHIVAMOGGA_PARTNERS.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                        <div className="text-[11px] text-slate-500">{p.cuisine}</div>
                        <div className="mt-2 text-[11px] text-orange-600 font-medium">
                          Today's Specials: {p.activeSpecials}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">{p.distanceKm} km</span>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          {p.reliability}% Reliability
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 5: Impact Analytics View ─────────────────────────────── */}
          {activeTab === 'impact' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900">JNNCE Campus Sustainability Ledger</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Real-time environmental and economic savings recorded across college cohorts.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Meals Diverted
                    </span>
                    <div className="mt-1 text-2xl font-black text-emerald-900">{totalPortionsSaved}</div>
                    <span className="text-[10px] text-emerald-700">Portions saved from landfill</span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                      CO₂ Avoided
                    </span>
                    <div className="mt-1 text-2xl font-black text-blue-900">~{co2AvoidedKg} kg</div>
                    <span className="text-[10px] text-blue-700">2.5 kg CO2e per meal ratio</span>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      Student Wallet Savings
                    </span>
                    <div className="mt-1 text-2xl font-black text-amber-900">₹{studentSavingsTotal}</div>
                    <span className="text-[10px] text-amber-700">Average ₹55 net savings per deal</span>
                  </div>
                </div>
              </div>

              {/* Swiggy Alignment Note */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600 leading-relaxed shadow-xs">
                <h4 className="font-bold text-slate-900 text-sm mb-2">
                  Strategic Alignment with Swiggy ESG & Marketplace Goals
                </h4>
                <p>
                  RescueBite creates an incremental revenue stream for restaurant partners on inventory that would otherwise be discarded, while delivering affordable fresh food to students during discrete campus break intervals. Zero fleet delivery cost is incurred since students complete self-pickup within their scheduled breaks.
                </p>
              </div>
            </div>
          )}

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <span>Verified Swiggy Food Partners</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-emerald-600" />
                <span>Campus Food Waste Reduction</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Swiggy Food for Thought 2.0 (2026–27) Prototype • Jawaharlal Nehru National College of Engineering (JNNCE), Shivamogga
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
