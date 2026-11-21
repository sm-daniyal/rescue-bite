import { API_BASE } from './constants'

// ── Types & Contracts ────────────────────────────────────────────────────────

export interface Restaurant {
  id: number
  name: string
  lat: number
  lng: number
  cuisine_type: string
  avg_prep_time_min: number
  reliability_score: number
}

export interface MenuItem {
  id: number
  restaurant_id: number
  name: string
  base_price: number
  category: string
  is_vegetarian: boolean
}

export interface FlashDeal {
  id: number
  surplus_event_id: number
  discount_pct: number
  ai_recommended_discount: number
  gemini_reasoning_snippet?: string | null
  deal_window_start: string
  deal_window_end: string
  restaurant?: Restaurant | null
  item?: MenuItem | null
}

export interface FlashDealDetail extends FlashDeal {
  score: number
}

export interface Reservation {
  id: number
  flash_deal_id: number
  student_id: number
  quantity: number
  status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'no_show'
  rejection_reason?: string | null
  created_at: string
  pickup_deadline: string
}

export interface ReservationCreate {
  flash_deal_id: number
  student_id: number
  quantity: number
}

export interface DashboardData {
  restaurant: Restaurant
  active_deals: FlashDeal[]
  pending_reservations: Reservation[]
  confirmed_reservations: Reservation[]
}

// ── Generic Fetch Helper ─────────────────────────────────────────────────────

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`
    try {
      const errorJson = await response.json()
      if (errorJson.detail) {
        errorDetail = errorJson.detail
      }
    } catch {
      // Ignore JSON parse failure on non-JSON response
    }
    throw new Error(errorDetail)
  }

  return response.json() as Promise<T>
}

// ── Typed API Endpoints ──────────────────────────────────────────────────────

export const api = {
  /** Fetch all active flash deals sorted by deal window urgency */
  getDeals: (): Promise<FlashDeal[]> => {
    return request<FlashDeal[]>('/deals')
  },

  /** Fetch full deal details including surplus score and AI reasoning */
  getDeal: (id: number): Promise<FlashDealDetail> => {
    return request<FlashDealDetail>(`/deals/${id}`)
  },

  /** Reserve a portion of an active flash deal */
  createReservation: (data: ReservationCreate): Promise<Reservation> => {
    return request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /** Restaurant confirms a pending reservation */
  confirmReservation: (id: number): Promise<Reservation> => {
    return request<Reservation>(`/reservations/${id}/confirm`, {
      method: 'PATCH',
    })
  },

  /** Restaurant rejects a reservation with an auditable reason */
  rejectReservation: (id: number, rejection_reason: string): Promise<Reservation> => {
    return request<Reservation>(`/reservations/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejection_reason }),
    })
  },

  /** Restaurant marks reservation as completed (picked up and paid) */
  completeReservation: (id: number): Promise<Reservation> => {
    return request<Reservation>(`/reservations/${id}/complete`, {
      method: 'PATCH',
    })
  },

  /** Fetch restaurant operational dashboard data */
  getRestaurantDashboard: (restaurantId: number): Promise<DashboardData> => {
    return request<DashboardData>(`/restaurants/${restaurantId}/dashboard`)
  },
}
