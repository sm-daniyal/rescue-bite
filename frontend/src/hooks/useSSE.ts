import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlashDeal, Reservation } from '../lib/api'

// ── Strongly Typed SSE Events ────────────────────────────────────────────────

export type SSEEvent =
  | { type: 'connected'; student_id?: number; restaurant_id?: number }
  | { type: 'new_deal'; deal: FlashDeal }
  | { type: 'break_bell'; deal_count: number; deals: FlashDeal[] }
  | { type: 'new_reservation'; reservation: Reservation }
  | { type: 'reservation_update'; reservation: Reservation }
  | { type: string; [key: string]: unknown }

export type SSEConnectionStatus = 'live' | 'reconnecting' | 'disconnected'

export interface UseSSEOptions<T = SSEEvent> {
  enabled?: boolean
  onMessage?: (event: T) => void
  onError?: (error: Event) => void
  maxReconnectAttempts?: number
  initialRetryDelayMs?: number
  maxRetryDelayMs?: number
}

export interface UseSSEReturn<T = SSEEvent> {
  status: SSEConnectionStatus
  lastEvent: T | null
  error: Event | null
  reconnect: () => void
}

/**
 * Custom React hook for robust Server-Sent Events (SSE) using the native EventSource API.
 * Features:
 * - Exponential backoff auto-reconnect
 * - Full type safety (zero `any` types)
 * - Connection status tracking ('live' | 'reconnecting' | 'disconnected')
 * - Automatic cleanup on unmount
 */
export function useSSE<T = SSEEvent>(
  url: string | null,
  options: UseSSEOptions<T> = {},
): UseSSEReturn<T> {
  const {
    enabled = true,
    onMessage,
    onError,
    maxReconnectAttempts = 10,
    initialRetryDelayMs = 1000,
    maxRetryDelayMs = 30000,
  } = options

  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected')
  const [lastEvent, setLastEvent] = useState<T | null>(null)
  const [error, setError] = useState<Event | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef<number>(0)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)

  // Keep callback refs fresh without resetting effect
  useEffect(() => {
    onMessageRef.current = onMessage
    onErrorRef.current = onError
  }, [onMessage, onError])

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    cleanup()

    if (!url || !enabled) {
      setStatus('disconnected')
      return
    }

    try {
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setStatus('live')
        setError(null)
        attemptsRef.current = 0
      }

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as T
          setLastEvent(parsed)
          onMessageRef.current?.(parsed)
        } catch {
          // If message is plain text or comment, ignore or handle gracefully
        }
      }

      es.onerror = (err: Event) => {
        setError(err)
        onErrorRef.current?.(err)
        es.close()
        eventSourceRef.current = null

        if (attemptsRef.current < maxReconnectAttempts) {
          setStatus('reconnecting')
          const delay = Math.min(
            initialRetryDelayMs * Math.pow(2, attemptsRef.current),
            maxRetryDelayMs,
          )
          attemptsRef.current += 1
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setStatus('disconnected')
        }
      }
    } catch (e: unknown) {
      setStatus('disconnected')
      if (e instanceof Event) {
        setError(e)
      }
    }
  }, [url, enabled, cleanup, initialRetryDelayMs, maxRetryDelayMs, maxReconnectAttempts])

  useEffect(() => {
    connect()
    return () => {
      cleanup()
    }
  }, [connect, cleanup])

  const reconnect = useCallback(() => {
    attemptsRef.current = 0
    connect()
  }, [connect])

  return {
    status,
    lastEvent,
    error,
    reconnect,
  }
}
