import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import { Product, WasteLog, WASTE_REASONS, WasteReason, TIME_PERIODS } from '../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function Waste() {
  const [products, setProducts] = useState<Product[]>([])
  const [todayWaste, setTodayWaste] = useState<WasteLog[]>([])
  const [weeklyWaste, setWeeklyWaste] = useState<WasteLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    waste_date: new Date().toISOString().split('T')[0],
    product_id: '',
    quantity_wasted: '',
    reason: '' as WasteReason | '',
    time_period_made: '',
    notes: '',
  })

  // Calculated cost
  const [calculatedCost, setCalculatedCost] = useState<number | null>(null)

  // Load products
  useEffect(() => {
    loadProducts()
  }, [])

  // Load waste data when date changes
  useEffect(() => {
    if (products.length > 0) {
      loadWasteData()
    }
  }, [formData.waste_date, products])

  // Calculate cost when product or quantity changes
  useEffect(() => {
    if (formData.product_id && formData.quantity_wasted) {
      const product = products.find(p => p.id === formData.product_id)
      if (product) {
        const quantity = parseInt(formData.quantity_wasted)
        if (!isNaN(quantity) && quantity > 0) {
          setCalculatedCost(product.cost_price * quantity)
        } else {
          setCalculatedCost(null)
        }
      }
    } else {
      setCalculatedCost(null)
    }
  }, [formData.product_id, formData.quantity_wasted, products])

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      setToast({ message: 'Failed to load products', type: 'error' })
    }
  }

  const loadWasteData = async () => {
    setIsLoading(true)
    try {
      // Load today's waste
      const { data: todayData, error: todayError } = await supabase
        .from('waste_logs')
        .select('*, products(*)')
        .eq('waste_date', formData.waste_date)
        .order('created_at', { ascending: false })

      if (todayError) throw todayError

      // Load this week's waste
      const weekStart = getWeekStart(new Date(formData.waste_date))
      const weekStartStr = weekStart.toISOString().split('T')[0]

      const { data: weeklyData, error: weeklyError } = await supabase
        .from('waste_logs')
        .select('*, products(*)')
        .gte('waste_date', weekStartStr)
        .order('waste_date', { ascending: false })

      if (weeklyError) throw weeklyError

      setTodayWaste(todayData || [])
      setWeeklyWaste(weeklyData || [])
    } catch (error) {
      console.error('Error loading waste data:', error)
      setToast({ message: 'Failed to load waste data', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    return new Date(d.setDate(diff))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.product_id || !formData.quantity_wasted || !formData.reason) {
      setToast({ message: 'Please fill in all required fields', type: 'error' })
      return
    }

    const quantity = parseInt(formData.quantity_wasted)
    if (isNaN(quantity) || quantity <= 0) {
      setToast({ message: 'Please enter a valid quantity', type: 'error' })
      return
    }

    setIsSaving(true)
    try {
      const product = products.find(p => p.id === formData.product_id)
      if (!product) throw new Error('Product not found')

      const wasteData = {
        waste_date: formData.waste_date,
        product_id: formData.product_id,
        quantity_wasted: quantity,
        cost_wasted: product.cost_price * quantity,
        reason: formData.reason,
        time_period_made: formData.time_period_made || null,
        notes: formData.notes || null,
      }

      if (editingId) {
        // Update existing entry
        const { error } = await supabase
          .from('waste_logs')
          .update(wasteData)
          .eq('id', editingId)

        if (error) throw error
        setToast({ message: 'Waste entry updated', type: 'success' })
        setEditingId(null)
      } else {
        // Create new entry
        const { error } = await supabase
          .from('waste_logs')
          .insert([wasteData])

        if (error) throw error
        setToast({ message: 'Waste logged successfully', type: 'success' })
      }

      // Reset form
      setFormData({
        waste_date: formData.waste_date,
        product_id: '',
        quantity_wasted: '',
        reason: '',
        time_period_made: '',
        notes: '',
      })
      
      // Reload data
      await loadWasteData()
    } catch (error) {
      console.error('Error saving waste:', error)
      setToast({ message: 'Failed to save waste entry', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (wasteLog: WasteLog) => {
    setEditingId(wasteLog.id)
    setFormData({
      waste_date: wasteLog.waste_date,
      product_id: wasteLog.product_id,
      quantity_wasted: wasteLog.quantity_wasted.toString(),
      reason: wasteLog.reason as WasteReason,
      time_period_made: wasteLog.time_period_made || '',
      notes: wasteLog.notes || '',
    })
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this waste entry?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('waste_logs')
        .delete()
        .eq('id', id)

      if (error) throw error

      setToast({ message: 'Waste entry deleted', type: 'success' })
      await loadWasteData()
    } catch (error) {
      console.error('Error deleting waste:', error)
      setToast({ message: 'Failed to delete waste entry', type: 'error' })
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({
      waste_date: formData.waste_date,
      product_id: '',
      quantity_wasted: '',
      reason: '',
      time_period_made: '',
      notes: '',
    })
  }

  // Calculate today's total
  const todayTotal = todayWaste.reduce((sum, log) => sum + (log.cost_wasted || 0), 0)

  // Calculate weekly summary
  const weeklyTotal = weeklyWaste.reduce((sum, log) => sum + (log.cost_wasted || 0), 0)
  const weeklyUnits = weeklyWaste.reduce((sum, log) => sum + log.quantity_wasted, 0)

  // Calculate top wasted products
  const productWasteMap = weeklyWaste.reduce((acc, log) => {
    const key = log.product_id
    if (!acc[key]) {
      acc[key] = {
        product_id: log.product_id,
        product_name: log.products?.name || 'Unknown',
        total_quantity: 0,
        total_cost: 0,
        reasons: {} as Record<string, number>,
      }
    }
    acc[key].total_quantity += log.quantity_wasted
    acc[key].total_cost += log.cost_wasted || 0
    acc[key].reasons[log.reason] = (acc[key].reasons[log.reason] || 0) + 1
    return acc
  }, {} as Record<string, { product_id: string; product_name: string; total_quantity: number; total_cost: number; reasons: Record<string, number> }>)

  const topWastedProducts = Object.values(productWasteMap)
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 5)

  const mostWastedProduct = topWastedProducts[0]

  // Get primary reason for a product
  const getPrimaryReason = (reasons: Record<string, number>) => {
    return Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  }

  // Calculate daily waste for chart (last 7 days)
  const getLast7Days = () => {
    const days = []
    const today = new Date(formData.waste_date)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      days.push(date.toISOString().split('T')[0])
    }
    return days
  }

  const last7Days = getLast7Days()
  const dailyWasteData = last7Days.map(date => {
    const dayWaste = weeklyWaste.filter(log => log.waste_date === date)
    const total = dayWaste.reduce((sum, log) => sum + (log.cost_wasted || 0), 0)
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
    return {
      date: dayName,
      fullDate: date,
      cost: parseFloat(total.toFixed(2)),
    }
  })

  // Calculate waste patterns
  const calculatePatterns = () => {
    const patterns: string[] = []

    // Group by day of week
    const dayOfWeekMap = weeklyWaste.reduce((acc, log) => {
      const date = new Date(log.waste_date)
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
      if (!acc[dayOfWeek]) {
        acc[dayOfWeek] = { count: 0, total: 0 }
      }
      acc[dayOfWeek].count += 1
      acc[dayOfWeek].total += log.cost_wasted || 0
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    // Find days with most waste
    const sortedDays = Object.entries(dayOfWeekMap)
      .sort((a, b) => b[1].total - a[1].total)

    if (sortedDays.length > 0 && sortedDays[0][1].total > 0) {
      patterns.push(`⚠️ ${sortedDays[0][0]}: Highest waste day this week (€${sortedDays[0][1].total.toFixed(2)})`)
    }

    // Check for overproduction pattern
    const overproductionCount = weeklyWaste.filter(log => log.reason === 'Overproduction').length
    const overproductionPercent = weeklyWaste.length > 0 ? (overproductionCount / weeklyWaste.length) * 100 : 0
    
    if (overproductionPercent > 30) {
      patterns.push(`⚠️ ${overproductionPercent.toFixed(0)}% of waste is from overproduction - consider reducing forecast`)
    }

    // Check for low waste days
    if (sortedDays.length > 1 && sortedDays[sortedDays.length - 1][1].total < weeklyTotal / 7 * 0.3) {
      patterns.push(`✅ ${sortedDays[sortedDays.length - 1][0]}: Only €${sortedDays[sortedDays.length - 1][1].total.toFixed(2)} waste - you're dialed in!`)
    }

    // Check for specific time period issues
    const timePeriodMap = weeklyWaste.reduce((acc, log) => {
      if (log.time_period_made) {
        if (!acc[log.time_period_made]) {
          acc[log.time_period_made] = { count: 0, total: 0 }
        }
        acc[log.time_period_made].count += 1
        acc[log.time_period_made].total += log.cost_wasted || 0
      }
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    const highestTimePeriod = Object.entries(timePeriodMap)
      .sort((a, b) => b[1].total - a[1].total)[0]

    if (highestTimePeriod && highestTimePeriod[1].total > weeklyTotal * 0.4) {
      patterns.push(`⚠️ ${highestTimePeriod[0]}: ${((highestTimePeriod[1].total / weeklyTotal) * 100).toFixed(0)}% of waste - review production timing`)
    }

    if (patterns.length === 0) {
      patterns.push('📊 Not enough data yet for pattern analysis')
    }

    return patterns
  }

  const wastePatterns = calculatePatterns()

  // Format currency
  const formatCurrency = (amount: number) => {
    return `€${amount.toFixed(2)}`
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Waste Tracking</h2>
        <p className="mt-2 text-gray-600">Monitor and reduce waste to improve profitability</p>
      </div>

      {/* Waste Entry Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          {editingId ? 'Edit Waste Entry' : 'Log Waste'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.waste_date}
                onChange={(e) => setFormData({ ...formData, waste_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a product...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Cost: {formatCurrency(product.cost_price)})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity Wasted <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity_wasted}
                onChange={(e) => setFormData({ ...formData, quantity_wasted: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quantity"
                required
              />
            </div>

            {/* Calculated Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Wasted
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-lg font-semibold text-red-600">
                {calculatedCost !== null ? formatCurrency(calculatedCost) : '—'}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value as WasteReason })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a reason...</option>
                {WASTE_REASONS.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Time Period Made */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Period Made
              </label>
              <select
                value={formData.time_period_made}
                onChange={(e) => setFormData({ ...formData, time_period_made: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select time period...</option>
                {TIME_PERIODS.map(period => (
                  <option key={period.value} value={period.value}>
                    {period.label} ({period.hours})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional details..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSaving ? 'Saving...' : (editingId ? 'Update Waste Entry' : 'Log Waste')}
            </button>
            
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Today's Waste Entries */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Today's Waste ({new Date(formData.waste_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })})
          </h3>
          <div className="text-2xl font-bold text-red-600">
            Total: {formatCurrency(todayTotal)}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading waste data...</p>
          </div>
        ) : todayWaste.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No waste entries for this date yet - great job! 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reason</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Time Made</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {todayWaste.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{log.products?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">{log.quantity_wasted}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">
                      {formatCurrency(log.cost_wasted || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.reason}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {log.time_period_made || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(log)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Edit"
                      >
                        <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Total Waste Cost This Week */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">Total Waste Cost This Week</p>
              <p className="text-3xl font-bold text-red-900">{formatCurrency(weeklyTotal)}</p>
            </div>
            <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Total Units Wasted */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-800 mb-1">Total Units Wasted</p>
              <p className="text-3xl font-bold text-orange-900">{weeklyUnits}</p>
            </div>
            <svg className="w-12 h-12 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        {/* Most Wasted Product */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">Most Wasted Product</p>
              <p className="text-lg font-bold text-yellow-900 truncate">
                {mostWastedProduct ? mostWastedProduct.product_name : 'N/A'}
              </p>
              <p className="text-sm text-yellow-700">
                {mostWastedProduct ? formatCurrency(mostWastedProduct.total_cost) : '—'}
              </p>
            </div>
            <svg className="w-12 h-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Top 5 Wasted Products */}
      {topWastedProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Top 5 Wasted Products This Week</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Total Qty</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Primary Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topWastedProducts.map((product, index) => (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">#{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_name}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">{product.total_quantity}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">
                      {formatCurrency(product.total_cost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{getPrimaryReason(product.reasons)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Waste Patterns */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Waste Patterns & Insights</h3>
        <div className="space-y-3">
          {wastePatterns.map((pattern, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                pattern.includes('✅') 
                  ? 'bg-green-50 border border-green-200' 
                  : pattern.includes('⚠️')
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{pattern}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Waste Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Daily Waste Cost - Last 7 Days</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyWasteData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => {
                  const item = dailyWasteData.find(d => d.date === label)
                  return item ? new Date(item.fullDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : label
                }}
              />
              <Bar dataKey="cost" radius={[8, 8, 0, 0]}>
                {dailyWasteData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.cost > weeklyTotal / 7 ? '#ef4444' : entry.cost < weeklyTotal / 7 * 0.5 ? '#22c55e' : '#f59e0b'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Low waste day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Average waste</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>High waste day</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default Waste
