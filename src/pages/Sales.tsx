import { useState, useEffect, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Product, SalesData, TIME_PERIODS, TimePeriod } from '../types'
import Toast from '../components/Toast'

interface ToastState {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

interface FormData {
  sale_date: string
  product_id: string
  time_period: TimePeriod | ''
  quantity_sold: string
}

interface FormErrors {
  product_id?: string
  time_period?: string
  quantity_sold?: string
}

interface SalesEntry extends SalesData {
  products: Product
}

function Sales() {
  const [products, setProducts] = useState<Product[]>([])
  const [salesData, setSalesData] = useState<SalesEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' })
  
  const [formData, setFormData] = useState<FormData>({
    sale_date: new Date().toISOString().split('T')[0],
    product_id: '',
    time_period: '',
    quantity_sold: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    Promise.all([fetchProducts(), fetchTodaysSales()])
      .finally(() => setLoading(false))
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
      showToast('Failed to load products', 'error')
    }
  }

  const fetchTodaysSales = async (date?: string) => {
    const targetDate = date || formData.sale_date
    
    try {
      const { data, error } = await supabase
        .from('sales_data')
        .select(`
          *,
          products (*)
        `)
        .eq('sale_date', targetDate)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSalesData(data as SalesEntry[] || [])
    } catch (err) {
      console.error('Error fetching sales:', err)
      showToast('Failed to load sales data', 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type })
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: FormErrors = {}

    if (!formData.product_id) {
      newErrors.product_id = 'Please select a product'
    }

    if (!formData.time_period) {
      newErrors.time_period = 'Please select a time period'
    }

    const quantity = parseInt(formData.quantity_sold)
    if (!formData.quantity_sold || isNaN(quantity)) {
      newErrors.quantity_sold = 'Quantity is required'
    } else if (quantity <= 0) {
      newErrors.quantity_sold = 'Quantity must be positive'
    } else if (!Number.isInteger(quantity)) {
      newErrors.quantity_sold = 'Quantity must be a whole number'
    }

    // Check for duplicates (only when creating new entry)
    if (!editingId && formData.product_id && formData.time_period) {
      const duplicate = salesData.find(
        sale => 
          sale.product_id === formData.product_id && 
          sale.time_period === formData.time_period &&
          sale.sale_date === formData.sale_date
      )

      if (duplicate) {
        const product = products.find(p => p.id === formData.product_id)
        newErrors.product_id = `${product?.name} already recorded for ${formData.time_period}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!await validateForm()) return

    setSubmitting(true)

    try {
      const salesEntry = {
        product_id: formData.product_id,
        sale_date: formData.sale_date,
        time_period: formData.time_period,
        quantity_sold: parseInt(formData.quantity_sold),
      }

      if (editingId) {
        // Update existing entry
        const { error } = await supabase
          .from('sales_data')
          .update({
            ...salesEntry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error
        showToast('Sales entry updated successfully', 'success')
        setEditingId(null)
      } else {
        // Create new entry
        const { error } = await supabase
          .from('sales_data')
          .insert([salesEntry])

        if (error) throw error
        showToast('Sales entry added successfully', 'success')
      }

      // Reset form
      setFormData({
        sale_date: formData.sale_date, // Keep the same date
        product_id: '',
        time_period: '',
        quantity_sold: '',
      })
      setErrors({})

      // Refresh data
      await fetchTodaysSales()

      // Auto-focus product dropdown for quick next entry
      const productSelect = document.getElementById('product_id') as HTMLSelectElement
      if (productSelect) productSelect.focus()

    } catch (err) {
      console.error('Error saving sales entry:', err)
      showToast(err instanceof Error ? err.message : 'Failed to save sales entry', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (sale: SalesEntry) => {
    setEditingId(sale.id)
    setFormData({
      sale_date: sale.sale_date,
      product_id: sale.product_id,
      time_period: sale.time_period as TimePeriod,
      quantity_sold: sale.quantity_sold.toString(),
    })
    setErrors({})

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({
      sale_date: formData.sale_date,
      product_id: '',
      time_period: '',
      quantity_sold: '',
    })
    setErrors({})
  }

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`Delete sales entry for "${productName}"?`)) return

    try {
      const { error } = await supabase
        .from('sales_data')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('Sales entry deleted', 'success')
      await fetchTodaysSales()
    } catch (err) {
      showToast('Failed to delete entry', 'error')
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setFormData({ ...formData, sale_date: newDate })
    fetchTodaysSales(newDate)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  // Calculate totals
  const totalUnits = salesData.reduce((sum, sale) => sum + sale.quantity_sold, 0)
  const totalRevenue = salesData.reduce(
    (sum, sale) => sum + (sale.quantity_sold * sale.products.sell_price),
    0
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Sales Entry</h2>
          <p className="mt-2 text-gray-600">Record daily sales data</p>
        </div>
        <div className="bg-white rounded-lg shadow p-12 flex justify-center items-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Sales Entry</h2>
        <p className="mt-2 text-gray-600">Quick entry for daily sales data</p>
      </div>

      {/* Entry Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId ? 'Edit Sales Entry' : 'Add Sales Entry'}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Date */}
            <div>
              <label htmlFor="sale_date" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                id="sale_date"
                name="sale_date"
                value={formData.sale_date}
                onChange={handleDateChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Product */}
            <div>
              <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                id="product_id"
                name="product_id"
                value={formData.product_id}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                  errors.product_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {errors.product_id && (
                <p className="mt-1 text-xs text-red-600">{errors.product_id}</p>
              )}
            </div>

            {/* Time Period */}
            <div>
              <label htmlFor="time_period" className="block text-sm font-medium text-gray-700 mb-1">
                Time Period <span className="text-red-500">*</span>
              </label>
              <select
                id="time_period"
                name="time_period"
                value={formData.time_period}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                  errors.time_period ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select period</option>
                {TIME_PERIODS.map(period => (
                  <option key={period.value} value={period.value}>
                    {period.label} ({period.hours})
                  </option>
                ))}
              </select>
              {errors.time_period && (
                <p className="mt-1 text-xs text-red-600">{errors.time_period}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity_sold" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantity_sold"
                name="quantity_sold"
                value={formData.quantity_sold}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="0"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                  errors.quantity_sold ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.quantity_sold && (
                <p className="mt-1 text-xs text-red-600">{errors.quantity_sold}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Entries</h3>
          <p className="text-3xl font-bold text-gray-900">{salesData.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Units Sold</h3>
          <p className="text-3xl font-bold text-indigo-600">{totalUnits}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Sales Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Today's Sales ({new Date(formData.sale_date).toLocaleDateString('en-IE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })})
          </h3>
        </div>

        {salesData.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No sales entries yet</h3>
            <p className="mt-2 text-gray-600">Add your first sales entry using the form above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Time Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesData.map((sale) => {
                  const revenue = sale.quantity_sold * sale.products.sell_price
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sale.products.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{sale.time_period}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{sale.quantity_sold}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(sale.products.sell_price)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">{formatCurrency(revenue)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(sale)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(sale.id, sale.products.name)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sales
