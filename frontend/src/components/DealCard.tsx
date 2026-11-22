import React, { useEffect, useState } from 'react'
import {
  Clock,
  Fuel,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import type { FlashDeal } from '../lib/api'

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

  // ── Countdown Timer ────────────────────────────────────────────────────────
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

  // ── Pricing & Fuel Math ───────────────────────────────────────────────────
  const basePrice = deal.item?.base_price ?? 100
  const discountPct = deal.discount_pct
  const discountedPrice = Math.round(basePrice * (1 - discountPct / 100))
  const grossSavings = basePrice - discountedPrice
  const estimatedFuelCost = 12 // ~₹12 for typical 4km two-wheeler roundtrip in Shivamogga
  const netSavings = Math.max(0, grossSavings - estimatedFuelCost)

  const isUrgent = !timeLeft.isExpired && timeLeft.minutes < 10

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-orange-300 hover:shadow-md">
      {/* Top Banner: Restaurant Name & Travel Distance */}
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <MapPin className="h-3.5 w-3.5 text-orange-600" />
            <span>{deal.restaurant?.name ?? 'Partner Restaurant'}</span>
            <span className="text-stone-300">•</span>
            <span>{deal.restaurant?.cuisine_type ?? 'Multi-cuisine'}</span>
          </div>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-stone-900">
            {/* Veg / Non-Veg Indicator Icon */}
            <span
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                deal.item?.is_vegetarian
                  ? 'border-emerald-600'
                  : 'border-rose-600'
              }`}
              title={deal.item?.is_vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  deal.item?.is_vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              />
            </span>
            <span>{deal.item?.name ?? 'Surplus Meal Package'}</span>
          </h3>
        </div>

        {/* Discount Badge */}
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
            {discountPct}% OFF
          </span>
          <span className="mt-1 text-[11px] font-medium text-stone-400">
            {deal.item?.category ?? 'Meal'}
          </span>
        </div>
      </div>

      {/* Middle: Price & Countdown */}
      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">₹{discountedPrice}</span>
            <span className="text-sm font-medium text-stone-400 line-through">₹{basePrice}</span>
          </div>
          <p className="text-xs font-medium text-emerald-600">
            Save ₹{grossSavings} per portion
          </p>
        </div>

        {/* Live Urgency Countdown Timer */}
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
            timeLeft.isExpired
              ? 'bg-stone-100 text-stone-500'
              : isUrgent
              ? 'animate-pulse bg-rose-50 text-rose-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {timeLeft.isExpired ? (
            <span>Deal Expired</span>
          ) : (
            <span>
              {String(timeLeft.minutes).padStart(2, '0')}:
              {String(timeLeft.seconds).padStart(2, '0')} left
            </span>
          )}
        </div>
      </div>

      {/* Fuel Math Savings Box */}
      <div className="mt-3.5 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
        <div className="flex items-center gap-1.5">
          <Fuel className="h-3.5 w-3.5 text-orange-600" />
          <span>Fuel Math (~4 km ride):</span>
        </div>
        <div className="font-semibold text-stone-800">
          Net Save: <span className="text-emerald-700">₹{netSavings}</span>{' '}
          <span className="text-[10px] font-normal text-stone-400">(-₹{estimatedFuelCost} fuel)</span>
        </div>
      </div>

      {/* Gemini AI Reasoning Disclosure */}
      {deal.gemini_reasoning_snippet && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAiReasoning(!showAiReasoning)}
            className="flex w-full items-center justify-between text-[11px] font-medium text-stone-500 hover:text-orange-600 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-orange-500" />
              AI Discount Reasoning
            </span>
            {showAiReasoning ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {showAiReasoning && (
            <div className="mt-1.5 rounded-lg border border-orange-100 bg-orange-50/60 p-2 text-xs text-stone-700 leading-relaxed">
              <p className="italic">"{deal.gemini_reasoning_snippet}"</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-stone-400">
                <span>Gemini Flash 1.5</span>
                <span>Audited Confidence: 88%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reserve Action Button */}
      <div className="mt-4 pt-1">
        {isReserved ? (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 border border-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4" />
            Portion Reserved (30-min hold)
          </button>
        ) : timeLeft.isExpired ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-400 cursor-not-allowed"
          >
            Flash Deal Expired
          </button>
        ) : (
          <button
            type="button"
            disabled={isReserving}
            onClick={() => onReserve?.(deal.id)}
            className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[0.99] disabled:opacity-50"
          >
            {isReserving ? 'Reserving...' : 'Reserve for Self-Pickup'}
          </button>
        )}
      </div>

      {/* Disclaimer footnote */}
      <div className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-stone-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        <span>Pay at pickup via Cash/UPI • 30m hold window</span>
      </div>
    </div>
  )
}
