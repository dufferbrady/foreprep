// Add your TypeScript types and interfaces here

export interface User {
  id: string
  email: string
  created_at: string
}

// Product type for the product library
export interface Product {
  id: string
  name: string
  category: string
  cost_price: number
  sell_price: number
  shelf_life?: number // in hours
  prep_time?: number // in minutes
  storage_type?: string
  active: boolean // soft delete flag
  created_at: string
  updated_at?: string
}

// Sales data type for tracking daily sales
export interface SalesData {
  id: string
  product_id: string
  sale_date: string // ISO date string
  time_period: string
  quantity_sold: number
  created_at: string
  updated_at?: string
  // Joined data from products table (when fetching with join)
  products?: Product
}

// Time periods for sales tracking
export type TimePeriod = 'Breakfast' | 'Lunch' | 'Afternoon'

export const TIME_PERIODS: { value: TimePeriod; label: string; hours: string }[] = [
  { value: 'Breakfast', label: 'Breakfast', hours: '6-11am' },
  { value: 'Lunch', label: 'Lunch', hours: '11am-3pm' },
  { value: 'Afternoon', label: 'Afternoon', hours: '3pm-8pm' },
]

