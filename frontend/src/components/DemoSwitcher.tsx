import React from 'react'
import {
  Users,
  Store,
  Columns,
  PlayCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react'

export type ViewMode = 'student' | 'restaurant' | 'split'

export interface DemoSwitcherProps {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
  onTriggerScenario?: (scenarioKey: 'A' | 'B' | 'C') => void
}

export const DemoSwitcher: React.FC<DemoSwitcherProps> = ({
  currentView,
  onViewChange,
  onTriggerScenario,
}) => {
  return (
    <div className="border-b border-stone-200 bg-stone-900 px-4 py-2.5 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Hackathon Judge Context */}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-600 text-white font-bold text-xs">
            RB
          </span>
          <div>
            <span className="text-xs font-bold text-white tracking-wide">
              JUDGE WALKTHROUGH CONTROLS
            </span>
            <span className="ml-2 hidden sm:inline-block rounded-full bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300">
              Swiggy Food for Thought 2.0
            </span>
          </div>
        </div>

        {/* Center: View Switcher (Student / Restaurant / Split) */}
        <div className="flex items-center rounded-xl bg-stone-800 p-1">
          <button
            type="button"
            onClick={() => onViewChange('student')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              currentView === 'student'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Student Feed</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('restaurant')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              currentView === 'restaurant'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            <span>Restaurant Ops</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('split')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              currentView === 'split'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Split Demo</span>
          </button>
        </div>

        {/* Right: 1-Click Scenario Triggers for Judges */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-stone-400">
            <Sparkles className="h-3 w-3 text-orange-400" />
            Trigger Script:
          </span>

          <button
            type="button"
            onClick={() => onTriggerScenario?.('A')}
            title="Scenario A: Lunch Rescue (Biryani Paradise 51% off)"
            className="flex items-center gap-1 rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700 active:scale-95 transition-all"
          >
            <PlayCircle className="h-3 w-3 text-orange-400" />
            <span>Lunch Deal (A)</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScenario?.('B')}
            title="Scenario B: Evening Snack Bell (Meenakshi Bhavan 38% off)"
            className="flex items-center gap-1 rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700 active:scale-95 transition-all"
          >
            <PlayCircle className="h-3 w-3 text-amber-400" />
            <span>Break Bell (B)</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerScenario?.('C')}
            title="Scenario C: Counter Stockout Rejection Flow"
            className="flex items-center gap-1 rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700 active:scale-95 transition-all"
          >
            <HelpCircle className="h-3 w-3 text-rose-400" />
            <span>Reject Flow (C)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
