/**
 * StudentApp — the consumer-facing page at route "/".
 *
 * Layout contract:
 *   Mobile  (< 768 px): full-screen feed, sticky bottom tab bar.
 *   Desktop (>= 768 px): left sidebar + top navbar + multi-column break grid.
 *
 * Zero emojis. Zero merchant controls. Zero admin toggles.
 */
import React, { useMemo, useState } from 'react'
import {
  Leaf,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UtensilsCrossed,
  XCircle,
  Search,
  LayoutGrid,
  CalendarClock,
  Receipt,
  BarChart3,
  MapPin,
  RefreshCw,
  Bell,
  TrendingDown,
  Zap,
  X,
} from 'lucide-react'
import { useDeals } from '../hooks/useDeals'
import { useSSE } from '../hooks/useSSE'
import { api, type Reservation } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { DealCard } from '../components/DealCard'
import { BreakBellToast } from '../components/BreakBellToast'

// ─── Types ───────────────────────────────────────────────────────────────────
type TabId = 'deals' | 'schedule' | 'holds' | 'impact'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'deals',    label: 'Deals',    Icon: LayoutGrid   },
  { id: 'schedule', label: 'Schedule', Icon: CalendarClock },
  { id: 'holds',    label: 'My Holds', Icon: Receipt       },
  { id: 'impact',   label: 'Impact',   Icon: BarChart3     },
]

const CATEGORIES = ['All', 'Meals', 'Biryani', 'Snacks', 'Breakfast', 'Combos']

const BREAK_SLOTS = [
  {
    id:         0,
    label:      'Morning Tiffin',
    time:       '10:30 - 10:45',
    status:     'Completed',
    categories: ['Breakfast'],
  },
  {
    id:         1,
    label:      'Lunch Break',
    time:       '13:00 - 14:00',
    status:     'Active Now',
    isCurrent:  true,
    categories: ['Meals', 'Biryani'],
  },
  {
    id:         2,
    label:      'Evening Snacks',
    time:       '16:30 - 16:45',
    status:     'Scheduled',
    categories: ['Snacks', 'Combos'],
  },
]

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function DealCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <div className="skeleton h-6 w-20" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar (desktop only) ───────────────────────────────────────────────────
function Sidebar({
  activeTab,
  onSelectTab,
  holdsCount,
  connectionStatus,
}: {
  activeTab: TabId
  onSelectTab: (t: TabId) => void
  holdsCount: number
  connectionStatus: 'live' | 'reconnecting' | 'disconnected'
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white px-5 py-6">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 px-1 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fc8019] shadow-sm">
            <Zap className="h-5 w-5 text-white fill-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-900 tracking-tight">
              Swiggy <span className="text-[#fc8019]">Rescue</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Campus Food Network</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-orange-50 text-[#fc8019] font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#fc8019]' : 'text-slate-400'}`} />
                  {label}
                </span>
                {id === 'holds' && holdsCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fc8019] px-1.5 text-[10px] font-bold text-white">
                    {holdsCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer card */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-slate-700">Campus</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-[#fc8019]" />
            <span className="font-medium">JNNCE, Shivamogga</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 text-[12px]">
          <span className="text-slate-500">Live Feed</span>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connectionStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${connectionStatus === 'live' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── Top Navbar (desktop only) ────────────────────────────────────────────────
function TopNavbar({
  search,
  onSearch,
  dealCount,
  studentName,
}: {
  search: string
  onSearch: (q: string) => void
  dealCount: number
  studentName: string
}) {
  return (
    <header className="hidden md:flex border-b border-slate-200/80 bg-white px-6 py-3.5 items-center justify-between gap-6 shrink-0">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search for meals, biryani, dosa..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-[13px] text-slate-800 placeholder-slate-400 transition-colors focus:border-[#fc8019] focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-2 ring-1 ring-orange-100">
          <div className="relative">
            <Clock className="h-4 w-4 text-[#fc8019]" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-orange-50" />
          </div>
          <div className="text-[13px]">
            <span className="font-bold text-slate-800">Lunch Break</span>
            <span className="ml-1.5 text-slate-500">{dealCount} deals live</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-[13px] shadow-sm">
            {studentName.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-[13px] font-semibold text-slate-900 hidden lg:block">{studentName}</span>
        </div>
      </div>
    </header>
  )
}

// ─── Mobile header (mobile only) ─────────────────────────────────────────────
function MobileHeader({
  connectionStatus,
  dealCount,
  search,
  onSearch,
  showSearch,
  onToggleSearch,
}: {
  connectionStatus: string
  dealCount: number
  search: string
  onSearch: (q: string) => void
  showSearch: boolean
  onToggleSearch: () => void
}) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fc8019] shadow-sm">
            <Zap className="h-4.5 w-4.5 text-white fill-white" />
          </div>
          <div>
            <div className="text-[15px] font-extrabold tracking-tight text-slate-900">
              Swiggy <span className="text-[#fc8019]">Rescue</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin className="h-3 w-3" />
              <span>JNNCE, Shivamogga</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${connectionStatus === 'live' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connectionStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {connectionStatus === 'live' ? `${dealCount} Live` : 'Reconnecting'}
          </div>
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Toggle deal search"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100 transition-colors"
          >
            {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {showSearch && (
        <div className="px-4 pb-3">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search meals, biryani, dosa..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-800 placeholder-slate-400 focus:border-[#fc8019] focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
      )}
    </header>
  )
}

// ─── Break Bell mobile banner ─────────────────────────────────────────────────
function BreakBellBanner({
  dealCount,
  onView,
}: {
  dealCount: number
  onView: () => void
}) {
  return (
    <div className="md:hidden mx-4 mt-3 mb-1 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#fc8019] to-[#e67312] px-4 py-3.5 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-[14px] font-bold">Lunch Break is LIVE</div>
          <div className="text-[12px] text-white/80">{dealCount} flash deals near JNNCE</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onView}
        className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-[#fc8019] shadow-sm active:scale-95 transition-transform"
      >
        View
      </button>
    </div>
  )
}

// ─── Break Timeline (desktop) ─────────────────────────────────────────────────
function BreakTimeline({ activeSlot, onSelect }: { activeSlot: number; onSelect: (i: number) => void }) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      {BREAK_SLOTS.map(slot => {
        const isActive = activeSlot === slot.id
        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSelect(slot.id)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              slot.isCurrent
                ? 'border-orange-200 bg-orange-50/50 shadow-sm ring-1 ring-orange-100'
                : isActive
                ? 'border-slate-200 bg-white shadow-sm'
                : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{slot.time}</span>
                <h3 className="mt-1 text-[14px] font-bold text-slate-900">{slot.label}</h3>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                slot.isCurrent ? 'bg-[#fc8019] text-white' :
                slot.status === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              }`}>
                {slot.status}
              </span>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between text-[12px]">
              <div className={`flex h-7 items-center justify-center rounded-lg px-2 font-bold text-[11px] ${slot.isCurrent ? 'bg-[#fc8019] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {slot.isCurrent ? '51% avg' : slot.id === 0 ? '42% avg' : '38% avg'}
              </div>
              <span className="text-slate-400 font-medium">Discount</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Reservation status banner ────────────────────────────────────────────────
function ReservationBanner({
  res,
  onDismiss,
}: {
  res: Reservation
  onDismiss: () => void
}) {
  const statusColor =
    res.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50 ring-1 ring-emerald-100'
    : res.status === 'rejected' ? 'border-rose-200 bg-rose-50 ring-1 ring-rose-100'
    : res.status === 'completed' ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-100'
    : 'border-amber-200 bg-amber-50 ring-1 ring-amber-100'

  const statusBadge =
    res.status === 'confirmed' ? 'bg-emerald-600 text-white'
    : res.status === 'rejected' ? 'bg-rose-600 text-white'
    : res.status === 'completed' ? 'bg-blue-600 text-white'
    : 'bg-amber-500 text-white'

  return (
    <div className={`mb-4 mx-4 md:mx-0 rounded-2xl border p-4 ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {res.status === 'confirmed' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : res.status === 'rejected' ? (
            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500 shrink-0 animate-spin" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-slate-900">Hold #RB-{res.id}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadge}`}>
                {res.status}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-slate-700 leading-relaxed">
              {res.status === 'pending' && 'Waiting for restaurant confirmation (10-min SLA).'}
              {res.status === 'confirmed' && `Show Hold #RB-${res.id} at counter. Pay via Cash or UPI on pickup.`}
              {res.status === 'rejected' && `Unavailable: ${res.rejection_reason ?? 'sold out at counter'}.`}
              {res.status === 'completed' && 'Meal rescued. Order complete.'}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-600">
              Pickup by: {new Date(res.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        {(res.status === 'completed' || res.status === 'rejected') && (
          <button type="button" onClick={onDismiss} className="text-[13px] font-semibold text-slate-500 hover:text-slate-800 shrink-0 transition-colors">
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Deals tab (shared between mobile + desktop) ──────────────────────────────
function DealsTab({
  deals,
  loading,
  error,
  refreshDeals,
  activeSlot,
  onSelectSlot,
  onReserve,
  reservingId,
  reservedDealId,
  search,
  vegOnly,
  onToggleVeg,
  category,
  onCategory,
}: {
  deals: ReturnType<typeof useDeals>['deals']
  loading: boolean
  error: string | null
  refreshDeals: () => void
  activeSlot: number
  onSelectSlot: (i: number) => void
  onReserve: (id: number) => void
  reservingId: number | null
  reservedDealId: number | undefined
  search: string
  vegOnly: boolean
  onToggleVeg: () => void
  category: string
  onCategory: (c: string) => void
}) {
  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (vegOnly && !d.item?.is_vegetarian) return false
      if (category !== 'All' && d.item?.category !== category) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (
          !d.item?.name.toLowerCase().includes(q) &&
          !d.restaurant?.name.toLowerCase().includes(q) &&
          !(d.item?.category ?? '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [deals, vegOnly, category, search])

  // Partition by break slot categories
  const cols = useMemo(() => {
    const breakfastKeywords = ['dosa', 'idli', 'tiffin', 'breakfast', 'vada', 'bath']
    const lunchKeywords = ['meal', 'biryani', 'thali', 'rice', 'parcel']

    const col0 = filtered.filter(d =>
      d.item?.category === 'Breakfast' ||
      breakfastKeywords.some(k => d.item?.name.toLowerCase().includes(k))
    )
    const col1 = filtered.filter(d =>
      !col0.includes(d) && (
        d.item?.category === 'Meals' ||
        d.item?.category === 'Biryani' ||
        lunchKeywords.some(k => d.item?.name.toLowerCase().includes(k))
      )
    )
    const col2 = filtered.filter(d => !col0.includes(d) && !col1.includes(d))

    // Fallback: evenly spread when categorisation yields nothing
    if (col0.length === 0 && col1.length === 0) {
      const half = Math.ceil(filtered.length / 2)
      return { col0: [], col1: filtered.slice(0, half), col2: filtered.slice(half) }
    }
    return { col0, col1, col2 }
  }, [filtered])

  if (loading && deals.length === 0) {
    return (
      <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 md:space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-10 text-center shadow-sm">
        <div className="flex justify-center mb-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <XCircle className="h-7 w-7 text-rose-500" />
          </div>
        </div>
        <p className="text-[14px] font-semibold text-slate-800">{error}</p>
        <p className="mt-1 text-[13px] text-slate-500">Check your connection and try again</p>
        <button
          type="button"
          onClick={refreshDeals}
          className="mt-4 rounded-xl bg-[#fc8019] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#e67312] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x-mandatory">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategory(cat)}
              className={`shrink-0 snap-start min-h-[44px] md:min-h-0 rounded-full px-4 py-2 md:px-3.5 md:py-1.5 text-[13px] font-semibold transition-all ${
                category === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggleVeg}
          className={`flex items-center gap-2 min-h-[44px] md:min-h-0 rounded-full px-4 py-2 md:px-3.5 md:py-1.5 text-[13px] font-semibold transition-all shrink-0 ${
            vegOnly
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${vegOnly ? 'border-emerald-600 bg-emerald-600' : 'border-emerald-600'}`}>
            {vegOnly && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          Veg Only
        </button>
      </div>

      {/* Break timeline (desktop) */}
      <div className="hidden md:block">
        <BreakTimeline activeSlot={activeSlot} onSelect={onSelectSlot} />
      </div>

      {/* Mobile: active break label */}
      <div className="md:hidden mb-4 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 ring-1 ring-orange-100">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fc8019] opacity-50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#fc8019]" />
        </span>
        <span className="text-[13px] font-bold text-slate-800">Lunch Break — 13:00 to 14:00</span>
        <span className="rounded-full bg-[#fc8019] px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              <UtensilsCrossed className="h-8 w-8 text-slate-300" />
            </div>
          </div>
          <h3 className="text-[15px] font-bold text-slate-900">No deals match your filter</h3>
          <p className="mt-2 text-[13px] text-slate-500 max-w-xs mx-auto">Deals publish before each campus break window. Check back at 13:00 for Lunch deals.</p>
        </div>
      ) : (
        <>
          {/* Desktop: 3-col break-slot layout */}
          <div className="hidden md:grid grid-cols-3 gap-5">
            {/* Morning */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Morning Tiffin</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{cols.col0.length}</span>
              </div>
              {cols.col0.map(d => (
                <DealCard key={d.id} deal={d} onReserve={onReserve} isReserving={reservingId === d.id} isReserved={reservedDealId === d.id} />
              ))}
              {cols.col0.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-400">Window cleared.</div>
              )}
            </div>

            {/* Lunch */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#fc8019] pb-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#fc8019]">Lunch Break</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-[#fc8019]">Active</span>
              </div>
              {cols.col1.map(d => (
                <DealCard key={d.id} deal={d} onReserve={onReserve} isReserving={reservingId === d.id} isReserved={reservedDealId === d.id} />
              ))}
              {cols.col1.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-400">No lunch deals active.</div>
              )}
            </div>

            {/* Evening */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Evening Snacks</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{cols.col2.length}</span>
              </div>
              {cols.col2.map(d => (
                <DealCard key={d.id} deal={d} onReserve={onReserve} isReserving={reservingId === d.id} isReserved={reservedDealId === d.id} />
              ))}
              {cols.col2.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-400">Scheduled 16:30.</div>
              )}
            </div>
          </div>

          {/* Mobile: single column */}
          <div className="md:hidden space-y-4 px-4">
            {filtered.map(d => (
              <DealCard key={d.id} deal={d} onReserve={onReserve} isReserving={reservingId === d.id} isReserved={reservedDealId === d.id} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Schedule tab ─────────────────────────────────────────────────────────────
function ScheduleTab() {
  const slots = [
    { label: 'Morning Break', time: '10:30 - 10:45', desc: 'Idli, Dosa, Tiffin & Filter Coffee', partners: 'Hotel Samrat Ashok, Sri Venkateshwara Grand, Udupi Sri Krishna', badge: 'Completed', cls: 'bg-slate-100 text-slate-500' },
    { label: 'Lunch Break', time: '13:00 - 14:00', desc: 'Meals, Biryani, Thali & Parottas', partners: 'Biryani Paradise, Hotel Jewel Rock, Malnad Kitchen, Samrat Ashok', badge: 'Active Now', cls: 'bg-[#fc8019] text-white' },
    { label: 'Evening Break', time: '16:30 - 16:45', desc: 'Vada Sambar, Bhajji, Tea & Juices', partners: 'Meenakshi Bhavan Darshini, Sri Guru Darshini', badge: 'Scheduled', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  ]
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[17px] font-bold text-slate-900">JNNCE Break Schedule</h3>
        <p className="mt-1 text-[13px] text-slate-500">Deals open 15 min before each bell. Reserve before the window closes.</p>
      </div>
      {slots.map(s => (
        <div key={s.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold text-slate-900">{s.label}</div>
              <div className="text-[13px] text-slate-500 font-medium">{s.time}</div>
              <div className="mt-2 text-[13px] text-slate-700">{s.desc}</div>
              <div className="mt-1 text-[12px] text-slate-400">{s.partners}</div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase ${s.cls}`}>{s.badge}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Holds tab ────────────────────────────────────────────────────────────────
function HoldsTab({ reservation }: { reservation: Reservation | null }) {
  if (!reservation) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
          <Receipt className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="text-[15px] font-bold text-slate-900">No Active Holds</h3>
        <p className="mt-2 text-[13px] text-slate-500 max-w-xs">When you reserve a flash deal, your 30-minute counter hold appears here.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <span className="text-[15px] font-bold text-slate-900">Active Hold #RB-{reservation.id}</span>
          <span className="ml-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">{reservation.status}</span>
        </div>
      </div>
      <div className="rounded-xl bg-emerald-50 p-4 space-y-2">
        <p className="text-[13px] text-slate-700">Quantity: {reservation.quantity} portion — Counter pay (Cash / UPI) on pickup.</p>
        <p className="text-[13px] font-semibold text-emerald-800">
          Pickup deadline: {new Date(reservation.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ─── Impact tab ───────────────────────────────────────────────────────────────
function ImpactTab({ dealCount }: { dealCount: number }) {
  const meals = dealCount > 0 ? 38 : 0
  const co2 = Math.round(meals * 2.5)
  const savings = meals * 55
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[17px] font-bold text-slate-900">JNNCE Sustainability Ledger</h3>
        <p className="mt-1 text-[13px] text-slate-500">Cumulative environmental and economic savings from JNNCE student cohort.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Meals Diverted', value: `${meals}`, sub: 'Portions saved from landfill', icon: UtensilsCrossed, accent: 'bg-emerald-50 ring-emerald-100', iconCls: 'text-emerald-600' },
          { label: 'CO2 Avoided', value: `~${co2} kg`, sub: '2.5 kg CO2e per meal ratio', icon: Leaf, accent: 'bg-blue-50 ring-blue-100', iconCls: 'text-blue-600' },
          { label: 'Student Savings', value: `₹${savings}`, sub: 'Avg ₹55 net save per deal', icon: TrendingDown, accent: 'bg-amber-50 ring-amber-100', iconCls: 'text-amber-600' },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl p-5 text-center ring-1 ${c.accent}`}>
            <div className="flex justify-center mb-2">
              <c.icon className={`h-6 w-6 ${c.iconCls}`} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className="mt-1 text-3xl font-black text-slate-900">{c.value}</div>
            <div className="mt-1 text-[12px] text-slate-500">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
        <h4 className="text-[15px] font-bold text-slate-900 mb-2">Swiggy Platform Alignment</h4>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          RescueBite creates incremental GMV from orders that would otherwise be zero revenue, while giving restaurant partners a structured channel to clear surplus inventory without manual price negotiations. Zero delivery fleet cost is incurred — students complete self-pickup within their scheduled break intervals.
        </p>
      </div>
    </div>
  )
}

// ─── Main StudentApp ──────────────────────────────────────────────────────────
export function StudentApp() {
  const STUDENT_ID   = 1
  const STUDENT_NAME = 'Rahul Sharma'

  const { deals, loading, error, connectionStatus, refreshDeals } = useDeals({ studentId: STUDENT_ID })

  const [activeTab,    setActiveTab]    = useState<TabId>('deals')
  const [activeSlot,   setActiveSlot]   = useState(1)
  const [search,       setSearch]       = useState('')
  const [showSearch,   setShowSearch]   = useState(false)
  const [vegOnly,      setVegOnly]      = useState(false)
  const [category,     setCategory]     = useState('All')

  const [reservation,     setReservation]     = useState<Reservation | null>(null)
  const [reservingId,     setReservingId]     = useState<number | null>(null)
  const [reservationError, setReservationError] = useState<string | null>(null)

  const [breakBellOpen,  setBreakBellOpen]  = useState(false)
  const [breakBellCount, setBreakBellCount] = useState(0)

  const sseUrl = `${API_BASE}/sse/student/${STUDENT_ID}`
  useSSE(sseUrl, {
    onMessage: event => {
      if (event.type === 'break_bell' && 'deals' in event) {
        setBreakBellCount((event.deals as unknown[]).length)
        setBreakBellOpen(true)
      } else if (event.type === 'reservation_update' && 'reservation' in event) {
        setReservation(event.reservation)
      }
    },
  })

  const handleReserve = async (dealId: number) => {
    try {
      setReservingId(dealId)
      setReservationError(null)
      const res = await api.createReservation({ flash_deal_id: dealId, student_id: STUDENT_ID, quantity: 1 })
      setReservation(res)
    } catch (err: unknown) {
      setReservationError(err instanceof Error ? err.message : 'Reservation failed')
    } finally {
      setReservingId(null)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-[#f7f7f8] text-slate-900 font-sans overflow-hidden">
      {/* Toast (desktop only) */}
      <div className="hidden md:block">
        <BreakBellToast
          open={breakBellOpen}
          onOpenChange={setBreakBellOpen}
          dealCount={breakBellCount || deals.length}
          breakLabel="Lunch Break (13:00 - 14:00)"
          onViewDeals={() => setActiveTab('deals')}
        />
      </div>

      {/* Desktop layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          holdsCount={reservation ? 1 : 0}
          connectionStatus={connectionStatus}
        />

        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <TopNavbar
            search={search}
            onSearch={setSearch}
            dealCount={deals.length}
            studentName={STUDENT_NAME}
          />

          {/* Mobile header */}
          <MobileHeader
            connectionStatus={connectionStatus}
            dealCount={deals.length}
            search={search}
            onSearch={setSearch}
            showSearch={showSearch}
            onToggleSearch={() => setShowSearch(v => !v)}
          />

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto scroll-smooth-touch">
            {/* Break bell banner (mobile) */}
            {breakBellOpen && (
              <BreakBellBanner
                dealCount={breakBellCount || deals.length}
                onView={() => {
                  setActiveTab('deals')
                  setBreakBellOpen(false)
                }}
              />
            )}

            <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto w-full">
              {/* Reservation banner */}
              {reservation && (
                <ReservationBanner res={reservation} onDismiss={() => setReservation(null)} />
              )}

              {/* Error */}
              {reservationError && (
                <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-800 ring-1 ring-rose-200 flex items-center justify-between">
                  <span>{reservationError}</span>
                  <button type="button" onClick={() => setReservationError(null)} className="font-bold hover:underline">Close</button>
                </div>
              )}

              {/* Desktop tab heading */}
              <div className="hidden md:flex items-center justify-between mb-6">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#fc8019]">Surplus Food Marketplace</span>
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-0.5">JNNCE Break Window Deals</h2>
                  <p className="mt-1 text-[13px] text-slate-500">AI pricing by Gemini Flash 1.5 — Self-pickup within 5 km radius</p>
                </div>
                <button
                  type="button"
                  onClick={refreshDeals}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Tab content */}
              {activeTab === 'deals' && (
                <DealsTab
                  deals={deals}
                  loading={loading}
                  error={error}
                  refreshDeals={refreshDeals}
                  activeSlot={activeSlot}
                  onSelectSlot={setActiveSlot}
                  onReserve={handleReserve}
                  reservingId={reservingId}
                  reservedDealId={reservation?.flash_deal_id}
                  search={search}
                  vegOnly={vegOnly}
                  onToggleVeg={() => setVegOnly(v => !v)}
                  category={category}
                  onCategory={setCategory}
                />
              )}
              {activeTab === 'schedule' && <ScheduleTab />}
              {activeTab === 'holds'    && <HoldsTab reservation={reservation} />}
              {activeTab === 'impact'   && <ImpactTab dealCount={deals.length} />}

              {/* Footer */}
              <footer className="mt-12 border-t border-slate-200/80 pt-6 pb-2 text-center">
                <div className="flex items-center justify-center gap-6 text-[12px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#fc8019]" />
                    <span>Verified Swiggy Partners</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Leaf className="h-4 w-4 text-emerald-500" />
                    <span>Zero Food Waste</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Swiggy Food for Thought 2.0 (2026-27) | JNNCE, Shivamogga
                </p>
              </footer>
            </div>
          </main>

          {/* Mobile bottom tab bar */}
          <nav className="md:hidden flex border-t border-slate-200/80 bg-white shrink-0 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-1 min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors ${
                    active ? 'text-[#fc8019]' : 'text-slate-400'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`h-5 w-5 ${active ? 'text-[#fc8019]' : 'text-slate-400'}`} />
                    {id === 'holds' && reservation && (
                      <span className="absolute -top-1 -right-1.5 h-3 w-3 rounded-full bg-[#fc8019] border-2 border-white" />
                    )}
                  </div>
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
