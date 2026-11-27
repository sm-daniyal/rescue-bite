import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Sparkles,
  Star,
} from 'lucide-react'
import type { FlashDeal } from '../lib/api'
import { getFoodImage } from '../lib/foodImages'

export interface DealCardProps {
  deal: FlashDeal
  onReserve?: (dealId: number) => void
  isReserved?: boolean
  isReserving?: boolean
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  onReserve,
  isReserved = false,
  isReserving = false,
}) => {
  const [showAiReasoning, setShowAiReasoning] = useState(false)
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean }>({
    minutes: 0,
    seconds: 0,
    isExpired: false,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const end = new Date(deal.deal_window_end).getTime()
      const diff = end - now

      if (diff <= 0) {
        return { minutes: 0, seconds: 0, isExpired: true }
      }

      const totalSeconds = Math.floor(diff / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return { minutes, seconds, isExpired: false }
    }

    setTimeLeft(calculateTimeLeft())

    const interval = setInterval(() => {
      const updated = calculateTimeLeft()
      setTimeLeft(updated)
      if (updated.isExpired) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [deal.deal_window_end])

  const basePrice = deal.item?.base_price ?? 100
  const discountPct = deal.discount_pct
  const discountedPrice = Math.round(basePrice * (1 - discountPct / 100))
  const grossSavings = basePrice - discountedPrice
  const estimatedFuelCost = 12
  const netSavings = Math.max(0, grossSavings - estimatedFuelCost)
  const isUrgent = !timeLeft.isExpired && timeLeft.minutes < 10
  const isVeg = deal.item?.is_vegetarian ?? false

  const imageUrl = getFoodImage(deal.item?.name ?? '', deal.item?.category ?? '')

  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-lg hover:ring-black/[0.08]">
      {/* Hero food image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={deal.item?.name ?? 'Surplus meal'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Gradient overlay at bottom for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Discount badge — top-left */}
        <div className="absolute left-3 top-3 rounded-lg bg-[#e23744] px-2.5 py-1 shadow-md">
          <span className="text-sm font-extrabold text-white">{discountPct}% OFF</span>
        </div>

        {/* Countdown badge — top-right */}
        <div
          className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1 shadow-md backdrop-blur-md ${
            timeLeft.isExpired
              ? 'bg-slate-800/70 text-slate-300'
              : isUrgent
              ? 'bg-red-600/90 text-white animate-pulse'
              : 'bg-black/50 text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs font-bold tabular-nums tracking-wide">
            {timeLeft.isExpired
              ? 'Expired'
              : `${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`}
          </span>
        </div>

        {/* Veg/Non-veg indicator — bottom-left on image */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 bg-white ${
              isVeg ? 'border-emerald-600' : 'border-red-600'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isVeg ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            />
          </span>
        </div>

        {/* Restaurant distance — bottom-right on image */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 backdrop-blur-sm">
          <MapPin className="h-3 w-3 text-white/80" />
          <span className="text-[11px] font-medium text-white/90">2.1 km</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 pt-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-bold leading-snug text-slate-900">
              {deal.item?.name ?? 'Surplus Package'}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
              <span className="truncate">{deal.restaurant?.name ?? 'Partner Outlet'}</span>
              <span className="text-slate-300">|</span>
              <span className="shrink-0">{deal.item?.category ?? 'Meal'}</span>
            </div>
          </div>

          {/* Rating badge */}
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5">
            <Star className="h-3 w-3 fill-white text-white" />
            <span className="text-[11px] font-bold text-white">4.2</span>
          </div>
        </div>

        {/* Price row */}
        <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-slate-900">
                ₹{discountedPrice}
              </span>
              <span className="text-sm font-medium text-slate-400 line-through">
                ₹{basePrice}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <span>You save ₹{netSavings}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">-₹{estimatedFuelCost} fuel</span>
            </div>
          </div>

          {/* Reserve CTA */}
          {isReserved ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Reserved
            </span>
          ) : timeLeft.isExpired ? (
            <span className="rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-400">
              Ended
            </span>
          ) : (
            <button
              type="button"
              disabled={isReserving}
              onClick={() => onReserve?.(deal.id)}
              className="min-h-[48px] rounded-xl bg-[#fc8019] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#e67312] active:scale-[0.97] disabled:opacity-50"
            >
              {isReserving ? 'Reserving...' : 'Reserve Now'}
            </button>
          )}
        </div>

        {/* AI Pricing Insight — expandable */}
        {deal.gemini_reasoning_snippet && (
          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={() => setShowAiReasoning(!showAiReasoning)}
              className="flex w-full items-center justify-between py-1 text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-600"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                AI Pricing Rationale
              </span>
              {showAiReasoning ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showAiReasoning && (
              <div className="mt-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <p className="text-[12px] leading-relaxed text-slate-700">
                  &ldquo;{deal.gemini_reasoning_snippet}&rdquo;
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Gemini Flash 1.5</span>
                  <span>Clearance confidence: 88%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
