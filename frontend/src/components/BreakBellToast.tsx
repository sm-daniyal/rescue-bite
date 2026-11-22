import React from 'react'
import * as Toast from '@radix-ui/react-toast'
import { Bell, Flame, X } from 'lucide-react'

export interface BreakBellToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealCount: number
  breakLabel?: string
  onViewDeals?: () => void
}

export const BreakBellToast: React.FC<BreakBellToastProps> = ({
  open,
  onOpenChange,
  dealCount,
  breakLabel = 'Campus Break Window',
  onViewDeals,
}) => {
  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root
        open={open}
        onOpenChange={onOpenChange}
        className="data-[state=open]:animate-slideIn data-[state=closed]:animate-hide flex w-full max-w-md items-start gap-3 rounded-2xl border border-orange-300 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-4 shadow-xl text-white"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
          <Bell className="h-5 w-5 text-white animate-bounce" />
        </div>

        <div className="flex-1">
          <Toast.Title className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <span>🔔 Break Bell Fired!</span>
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase">
              {breakLabel}
            </span>
          </Toast.Title>

          <Toast.Description className="mt-1 text-xs text-orange-50 leading-relaxed">
            <span className="font-semibold text-white">{dealCount} surplus flash deals</span> are
            now live within 5 km of JNNCE! Portions are limited for 30–45 mins.
          </Toast.Description>

          <div className="mt-3 flex items-center gap-2">
            <Toast.Action
              asChild
              altText="View available flash deals"
              onClick={() => {
                onViewDeals?.()
                onOpenChange(false)
              }}
            >
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-orange-600 shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
              >
                <Flame className="h-3.5 w-3.5 fill-orange-600" />
                View Deals Now
              </button>
            </Toast.Action>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <Toast.Close className="text-white/60 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </Toast.Close>
      </Toast.Root>

      <Toast.Viewport className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2 outline-none" />
    </Toast.Provider>
  )
}
