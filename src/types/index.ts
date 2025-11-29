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

