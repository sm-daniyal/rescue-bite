import { useCallback, useEffect, useState } from 'react'
import { api, type FlashDeal } from '../lib/api'
import { API_BASE } from '../lib/constants'
import { useSSE, type SSEConnectionStatus, type SSEEvent } from './useSSE'

export interface UseDealsOptions {
  studentId?: number
  autoFilterExpired?: boolean
}

export interface UseDealsReturn {
  deals: FlashDeal[]
  loading: boolean
  error: string | null
  connectionStatus: SSEConnectionStatus
  refreshDeals: () => Promise<void>
}

/**
 * Custom React hook that loads active deals on mount and subscribes to
 * real-time SSE updates for new deals and break bell broadcasts.
 */
export function useDeals(options: UseDealsOptions = {}): UseDealsReturn {
  const { studentId = 1, autoFilterExpired = true } = options

  const [deals, setDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Initial REST fetch
  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getDeals()
      setDeals(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch flash deals'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  // 2. Real-time updates via SSE
  const sseUrl = `${API_BASE}/sse/student/${studentId}`

  const handleSSEMessage = useCallback((event: SSEEvent) => {
    if (event.type === 'new_deal') {
      const newDeal = event.deal
      setDeals((prev) => {
        const exists = prev.some((d) => d.id === newDeal.id)
        if (exists) {
          return prev.map((d) => (d.id === newDeal.id ? newDeal : d))
        }
        return [newDeal, ...prev]
      })
    } else if (event.type === 'break_bell') {
      const incomingDeals = event.deals
      setDeals((prev) => {
        const existingIds = new Set(prev.map((d) => d.id))
        const brandNew = incomingDeals.filter((d) => !existingIds.has(d.id))
        return [...brandNew, ...prev]
      })
    }
  }, [])

  const { status: connectionStatus } = useSSE<SSEEvent>(sseUrl, {
    onMessage: handleSSEMessage,
  })

  // 3. Local timer to remove expired deals without full refetch
  useEffect(() => {
    if (!autoFilterExpired) return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      setDeals((prev) =>
        prev.filter((d) => new Date(d.deal_window_end).getTime() > now),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [autoFilterExpired])

  return {
    deals,
    loading,
    error,
    connectionStatus,
    refreshDeals: fetchDeals,
  }
}
