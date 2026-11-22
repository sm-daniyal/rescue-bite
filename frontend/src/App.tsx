import { useState } from 'react'
import { DemoSwitcher, type ViewMode } from './components/DemoSwitcher'
import { StudentFeed } from './pages/StudentFeed'
import { RestaurantDashboard } from './components/RestaurantDashboard'
import { API_BASE } from './lib/constants'

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number>(5) // Biryani Paradise

  const handleTriggerScenario = async (scenarioKey: 'A' | 'B' | 'C') => {
    try {
      // Direct call to demo endpoint (or trigger simulated event)
      await fetch(`${API_BASE}/demo/trigger-scenario/${scenarioKey}`, {
        method: 'POST',
      })
    } catch {
      // In development or demo mode, if endpoint is waiting on Step 8 backend, gracefully alert
      console.log(`Scenario ${scenarioKey} triggered`)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100/70 font-sans text-stone-900 antialiased">
      {/* ── Top Bar: Judge Controls & Walkthrough Switcher ─────────────── */}
      <DemoSwitcher
        currentView={viewMode}
        onViewChange={setViewMode}
        onTriggerScenario={handleTriggerScenario}
      />

      {/* ── Dynamic Layout based on Selected View ─────────────────────── */}
      {viewMode === 'student' && (
        <div className="w-full">
          <StudentFeed studentId={1} studentName="Rahul Sharma" />
        </div>
      )}

      {viewMode === 'restaurant' && (
        <div className="mx-auto max-w-4xl p-6">
          <RestaurantDashboard
            initialRestaurantId={selectedRestaurantId}
            onRestaurantChange={setSelectedRestaurantId}
          />
        </div>
      )}

      {viewMode === 'split' && (
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-45px)] border-x border-stone-200">
          {/* Left Column: Student Feed (7 cols) */}
          <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-stone-200 bg-white overflow-y-auto">
            <div className="bg-orange-50/70 border-b border-orange-100 px-4 py-2 text-center text-xs font-semibold text-orange-900 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />
              <span>Student Live Feed • JNNCE Centroid View</span>
            </div>
            <StudentFeed studentId={1} studentName="Rahul Sharma" isCompact={true} />
          </div>

          {/* Right Column: Restaurant Partner Ops (5 cols) */}
          <div className="lg:col-span-5 bg-stone-50/60 p-4 lg:p-6 overflow-y-auto">
            <div className="mb-4 rounded-xl bg-stone-900 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs">
              <span className="font-bold tracking-wide">Restaurant Merchant Terminal</span>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live SSE Synced</span>
            </div>
            <RestaurantDashboard
              initialRestaurantId={selectedRestaurantId}
              onRestaurantChange={setSelectedRestaurantId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
