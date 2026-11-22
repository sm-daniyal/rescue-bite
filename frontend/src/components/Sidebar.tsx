import React from 'react'
import {
  LayoutGrid,
  CalendarClock,
  Receipt,
  Store,
  BarChart3,
  MapPin,
} from 'lucide-react'

export type NavTab = 'deals' | 'schedule' | 'reservations' | 'partners' | 'impact'

export interface SidebarProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  activeReservationsCount?: number
  connectionStatus: 'live' | 'reconnecting' | 'disconnected'
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeReservationsCount = 0,
  connectionStatus,
}) => {
  const navItems = [
    { id: 'deals' as NavTab, label: 'Live Flash Deals', icon: LayoutGrid },
    { id: 'schedule' as NavTab, label: 'Break Windows', icon: CalendarClock },
    {
      id: 'reservations' as NavTab,
      label: 'My Reservations',
      icon: Receipt,
      badge: activeReservationsCount > 0 ? activeReservationsCount : undefined,
    },
    { id: 'partners' as NavTab, label: 'Partner Outlets', icon: Store },
    { id: 'impact' as NavTab, label: 'Impact Analytics', icon: BarChart3 },
  ]

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between p-5 min-h-screen">
      {/* Top: Brand Header */}
      <div>
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white font-black text-sm tracking-tight shadow-xs">
            SR
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Swiggy <span className="text-orange-600">Rescue</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400">
              Campus Distress Network
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-50 font-semibold text-orange-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom: Campus Context & SSE Status Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-700">Campus Centroid</span>
          <div className="flex items-center gap-1 font-medium text-slate-500">
            <MapPin className="h-3 w-3 text-orange-600" />
            <span>JNNCE</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-[11px]">
          <span className="text-slate-500">Live Telemetry</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === 'live'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span
              className={`text-[10px] font-semibold uppercase ${
                connectionStatus === 'live' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {connectionStatus}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-white p-2 border border-slate-200/60 text-[10px] text-slate-500 leading-normal">
          <div className="font-semibold text-slate-800">Break Schedule</div>
          <div>10:30, 13:00, 16:30 IST</div>
        </div>
      </div>
    </aside>
  )
}
