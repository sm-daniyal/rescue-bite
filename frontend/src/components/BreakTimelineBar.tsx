import React from 'react'

export interface BreakTimelineBarProps {
  activeSlotIndex?: number
  onSelectSlot?: (slotIndex: number) => void
}

export const BreakTimelineBar: React.FC<BreakTimelineBarProps> = ({
  activeSlotIndex = 1, // Default: Lunch Break active
  onSelectSlot,
}) => {
  const slots = [
    {
      id: 0,
      label: 'Morning Break',
      time: '10:30 – 10:45',
      status: 'Completed',
      mealsText: 'Breakfast & Tiffin',
      dealsCount: 2,
      statLabel: 'Avg Discount',
      statValue: '42%',
    },
    {
      id: 1,
      label: 'Lunch Break',
      time: '13:00 – 14:00',
      status: 'Active Now',
      mealsText: 'Meals & Biryani',
      dealsCount: 4,
      statLabel: 'Avg Discount',
      statValue: '51%',
      isCurrent: true,
    },
    {
      id: 2,
      label: 'Evening Break',
      time: '16:30 – 16:45',
      status: 'Scheduled',
      mealsText: 'Snacks & Tea',
      dealsCount: 2,
      statLabel: 'Avg Discount',
      statValue: '38%',
    },
  ]

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {slots.map((slot) => {
        const isSelected = activeSlotIndex === slot.id
        return (
          <div
            key={slot.id}
            onClick={() => onSelectSlot?.(slot.id)}
            className={`cursor-pointer rounded-2xl border p-4 transition-all duration-150 ${
              slot.isCurrent
                ? 'border-orange-300 bg-white shadow-sm ring-1 ring-orange-200'
                : isSelected
                ? 'border-slate-300 bg-white shadow-xs'
                : 'border-slate-200 bg-white/70 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {slot.time}
                </span>
                <h3 className="mt-0.5 text-sm font-bold text-slate-900">{slot.label}</h3>
                <p className="text-xs text-slate-500">{slot.mealsText}</p>
              </div>

              {/* Status Pill */}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  slot.isCurrent
                    ? 'bg-orange-100 text-orange-700'
                    : slot.status === 'Completed'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {slot.status}
              </span>
            </div>

            {/* Circular Metric Row (Inspired by reference UI) */}
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold text-[11px] ${
                    slot.isCurrent ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {slot.statValue}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    {slot.statLabel}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {slot.dealsCount} deals ready
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-medium text-slate-400 block uppercase">
                  Service Radius
                </span>
                <span className="text-xs font-bold text-slate-800">5.0 km JNNCE</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
