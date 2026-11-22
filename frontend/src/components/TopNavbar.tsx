import React from 'react'
import { Search, Clock } from 'lucide-react'

export interface TopNavbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  studentName?: string
  department?: string
  activeBreakLabel?: string
  dealCount: number
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  searchQuery,
  onSearchChange,
  studentName = 'Rahul Sharma',
  department = 'BE Computer Science',
  activeBreakLabel = 'Lunch Break (13:00 – 14:00)',
  dealCount,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-3.5">
      <div className="flex items-center justify-between gap-6">
        {/* Search Bar */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search surplus meals, biryani, dosas..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Right Section: Break Window Indicator & Profile */}
        <div className="flex items-center gap-4">
          {/* Active Break Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-1.5 text-xs text-orange-900">
            <Clock className="h-3.5 w-3.5 text-orange-600" />
            <span className="font-semibold">{activeBreakLabel}</span>
            <span className="text-orange-400">•</span>
            <span className="text-[11px] font-medium text-orange-700">{dealCount} Deals Active</span>
          </div>

          {/* Student Profile Chip */}
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200">
              RS
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-bold text-slate-900">{studentName}</div>
              <div className="text-[10px] text-slate-400 font-medium">{department}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
