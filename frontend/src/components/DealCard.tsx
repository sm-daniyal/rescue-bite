import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
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

  const imageUrl = getFoodImage(deal.item?.name ?? '', deal.item?.category ?? '')

  return (
    <div className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all duration-150 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-3.5">
        {/* Food Thumbnail (Square with rounded corners) */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
          <img
            src={imageUrl}
            alt={deal.item?.name ?? 'Surplus meal'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
            {discountPct}% OFF
          </span>
        </div>

        {/* Core Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Category & Veg Symbol */}
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                <span
                  className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border ${
                    deal.item?.is_vegetarian ? 'border-emerald-600' : 'border-rose-600'
                  }`}
                  title={deal.item?.is_vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      deal.item?.is_vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                </span>
                <span>{deal.item?.category ?? 'Meal'}</span>
                <span>•</span>
                <span className="truncate">{deal.restaurant?.name ?? 'Partner Outlet'}</span>
              </div>

              {/* Title */}
              <h4 className="mt-0.5 truncate text-xs font-bold text-slate-900 leading-tight">
                {deal.item?.name ?? 'Surplus Package'}
              </h4>
            </div>

            {/* Countdown Badge */}
            <div
              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                timeLeft.isExpired
                  ? 'bg-slate-100 text-slate-400'
                  : isUrgent
                  ? 'bg-rose-50 text-rose-700 animate-pulse'
                  : 'bg-orange-50 text-orange-700'
              }`}
            >
              {timeLeft.isExpired ? (
                'Expired'
              ) : (
                <span>
                  {String(timeLeft.minutes).padStart(2, '0')}:
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>

          {/* Pricing & Net Fuel Math */}
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-extrabold text-slate-900">₹{discountedPrice}</span>
                <span className="text-[11px] font-medium text-slate-400 line-through">₹{basePrice}</span>
              </div>
              <div className="text-[10px] font-medium text-emerald-700">
                Net save: ₹{netSavings} <span className="text-slate-400">(-₹{estimatedFuelCost} fuel)</span>
              </div>
            </div>

            {/* Reserve CTA */}
            <div>
              {isReserved ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Reserved
                </span>
              ) : timeLeft.isExpired ? (
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-400">
                  Ended
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isReserving}
                  onClick={() => onReserve?.(deal.id)}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isReserving ? 'Reserving...' : 'Reserve Hold'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable AI Pricing Insight */}
      {deal.gemini_reasoning_snippet && (
        <div className="mt-2.5 border-t border-slate-100/80 pt-1.5">
          <button
            type="button"
            onClick={() => setShowAiReasoning(!showAiReasoning)}
            className="flex w-full items-center justify-between text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-orange-500" />
              Dynamic Pricing Rationale
            </span>
            {showAiReasoning ? (
              <ChevronUp className="h-2.5 w-2.5" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5" />
            )}
          </button>

          {showAiReasoning && (
            <div className="mt-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 leading-relaxed border border-slate-100">
              <p>"{deal.gemini_reasoning_snippet}"</p>
              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 uppercase font-semibold">
                <span>Model: Gemini Flash 1.5</span>
                <span>Portion clearance confidence: 88%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
