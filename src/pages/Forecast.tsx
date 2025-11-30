import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import { ForecastItem, Product, SalesData, TIME_PERIODS, TimePeriod } from '../types'

function Forecast() {
  const [forecasts, setForecasts] = useState<ForecastItem[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isPrintView, setIsPrintView] = useState(false)

  // Calculate tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const tomorrowDayOfWeek = tomorrow.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Get day name
  const getDayName = (dayNum: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayNum]
  }

  // Generate forecasts using rolling 3-week average
  const generateForecasts = async () => {
    setIsGenerating(true)
    try {
      // 1. Get all active products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')

      if (productsError) throw productsError
      if (!products || products.length === 0) {
        setToast({ message: 'No active products found', type: 'error' })
        setIsGenerating(false)
        return
      }

      // 2. Get historical sales data for past 4 weeks (to ensure we have 3+ same-day-of-week entries)
      const fourWeeksAgo = new Date()
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

      const { data: salesData, error: salesError } = await supabase
        .from('sales_data')
        .select('*')
        .gte('sale_date', fourWeeksAgoStr)
        .order('sale_date', { ascending: false })

      if (salesError) throw salesError

      // 3. Calculate forecasts for each product and time period
      const newForecasts: ForecastItem[] = []

      for (const product of products as Product[]) {
        for (const timePeriod of TIME_PERIODS) {
          // Filter sales for this product, time period, and same day of week
          const relevantSales = (salesData as SalesData[] || []).filter(sale => {
            const saleDate = new Date(sale.sale_date)
            const saleDayOfWeek = saleDate.getDay()
            return (
              sale.product_id === product.id &&
              sale.time_period === timePeriod.value &&
              saleDayOfWeek === tomorrowDayOfWeek
            )
          })

          // Skip if no sales history in this time period
          if (relevantSales.length === 0) {
            continue
          }

          // Take most recent 3 weeks (or whatever is available)
          const recentSales = relevantSales.slice(0, 3)
          const weeksOfData = recentSales.length

          // Calculate average
          const totalSold = recentSales.reduce((sum, sale) => sum + sale.quantity_sold, 0)
          const average = totalSold / weeksOfData
          
          // Round UP to nearest whole number
          const forecastQty = Math.ceil(average)

          // Get last week's quantity for comparison (most recent same-day sale)
          const lastWeekQty = recentSales.length > 0 ? recentSales[0].quantity_sold : undefined

          newForecasts.push({
            product_id: product.id,
            product_name: product.name,
            time_period: timePeriod.value,
            forecast_quantity: forecastQty,
            last_week_quantity: lastWeekQty,
            weeks_of_data: weeksOfData,
            has_warning: weeksOfData < 3,
          })
        }
      }

      setForecasts(newForecasts)
      
      if (newForecasts.length === 0) {
        setToast({ 
          message: 'No forecast data available. This is likely your first week - enter quantities manually.', 
          type: 'info' 
        })
      } else {
        setToast({ message: 'Forecast generated successfully', type: 'success' })
      }
    } catch (error) {
      console.error('Error generating forecast:', error)
      setToast({ message: 'Failed to generate forecast', type: 'error' })
    } finally {
      setIsGenerating(false)
    }
  }

  // Save production plan to database
  const saveProductionPlan = async () => {
    if (forecasts.length === 0) {
      setToast({ message: 'No forecast to save. Generate forecast first.', type: 'error' })
      return
    }

    setIsSaving(true)
    try {
      // First, check if production_plans table exists, if not we'll get an error
      // Transform forecasts to production plan format
      const productionPlans = forecasts.map(forecast => ({
        plan_date: tomorrowStr,
        product_id: forecast.product_id,
        time_period: forecast.time_period,
        forecast_quantity: forecast.forecast_quantity,
        adjusted_quantity: forecast.manual_override,
      }))

      // Delete any existing plans for tomorrow (allow regeneration)
      await supabase
        .from('production_plans')
        .delete()
        .eq('plan_date', tomorrowStr)

      // Insert new production plans
      const { error } = await supabase
        .from('production_plans')
        .insert(productionPlans)

      if (error) {
        // If table doesn't exist, show helpful error
        if (error.message.includes('relation "production_plans" does not exist')) {
          setToast({ 
            message: 'Production plans table not yet created. Contact admin to set up database.', 
            type: 'error' 
          })
        } else {
          throw error
        }
      } else {
        setToast({ message: 'Production plan saved successfully', type: 'success' })
      }
    } catch (error) {
      console.error('Error saving production plan:', error)
      setToast({ message: 'Failed to save production plan', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // Update manual override for a forecast item
  const updateManualOverride = (productId: string, timePeriod: TimePeriod, value: string) => {
    const numValue = parseInt(value)
    setForecasts(prev => prev.map(forecast => {
      if (forecast.product_id === productId && forecast.time_period === timePeriod) {
        return {
          ...forecast,
          manual_override: value === '' ? undefined : (isNaN(numValue) ? undefined : numValue)
        }
      }
      return forecast
    }))
  }

  // Calculate comparison vs last week
  const getComparison = (forecast: ForecastItem) => {
    if (!forecast.last_week_quantity) return null
    
    const currentQty = forecast.manual_override ?? forecast.forecast_quantity
    const diff = currentQty - forecast.last_week_quantity
    
    if (diff === 0) return { arrow: '→', text: '0', color: 'text-gray-600' }
    if (diff > 0) return { arrow: '↑', text: `${diff}`, color: 'text-green-600' }
    return { arrow: '↓', text: `${Math.abs(diff)}`, color: 'text-red-600' }
  }

  // Group forecasts by time period
  const groupedForecasts = TIME_PERIODS.reduce((acc, period) => {
    acc[period.value] = forecasts.filter(f => f.time_period === period.value)
    return acc
  }, {} as Record<TimePeriod, ForecastItem[]>)

  // Print view
  const handlePrint = () => {
    setIsPrintView(true)
    setTimeout(() => {
      window.print()
      setIsPrintView(false)
    }, 100)
  }

  // Render forecast table for a time period
  const renderTimePeriodSection = (period: typeof TIME_PERIODS[0]) => {
    const items = groupedForecasts[period.value]
    
    if (items.length === 0) {
      return null
    }

    return (
      <div key={period.value} className="mb-8 break-inside-avoid">
        <h3 className="text-xl font-bold text-gray-900 mb-4 uppercase border-b-2 border-gray-300 pb-2">
          {period.label} ({period.hours})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Forecast Qty
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider print:hidden">
                  vs Last Week
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider print:hidden">
                  Manual Override
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider hidden print:table-cell">
                  Final Qty
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => {
                const comparison = getComparison(item)
                const finalQty = item.manual_override ?? item.forecast_quantity

                return (
                  <tr key={`${item.product_id}-${item.time_period}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.product_name}
                      {item.has_warning && (
                        <span className="ml-2 text-xs text-yellow-600 print:hidden">
                          ⚠️ Only {item.weeks_of_data} week{item.weeks_of_data !== 1 ? 's' : ''} of data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {item.forecast_quantity}
                    </td>
                    <td className="px-4 py-3 text-center text-sm print:hidden">
                      {comparison ? (
                        <span className={`font-medium ${comparison.color}`}>
                          {comparison.arrow} {comparison.text}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <input
                        type="number"
                        min="0"
                        value={item.manual_override ?? ''}
                        onChange={(e) => updateManualOverride(item.product_id, item.time_period, e.target.value)}
                        placeholder={item.forecast_quantity.toString()}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold hidden print:table-cell">
                      {finalQty}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={isPrintView ? 'print-view' : ''}>
      {/* Header Section */}
      <div className="mb-8 print:mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Production Forecast</h2>
        <p className="mt-2 text-gray-600">
          Rolling 3-week average based on {getDayName(tomorrowDayOfWeek)} sales history
        </p>
      </div>

      {/* Top Action Bar */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 print:shadow-none print:p-0">
        <div className="flex items-center justify-between mb-4 print:mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Forecast Date: {formatDate(tomorrow)}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {getDayName(tomorrowDayOfWeek)}
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <button
              onClick={generateForecasts}
              disabled={isGenerating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Forecast'
              )}
            </button>
            
            {forecasts.length > 0 && (
              <>
                <button
                  onClick={saveProductionPlan}
                  disabled={isSaving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Production Plan'
                  )}
                </button>
                
                <button
                  onClick={handlePrint}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Print
                </button>
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        {forecasts.length === 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg print:hidden">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">How to use:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Click "Generate Forecast" to calculate tomorrow's production needs</li>
              <li>Review forecasts - system uses rolling 3-week average for same day of week</li>
              <li>Adjust any quantity using "Manual Override" if your gut says different</li>
              <li>Click "Save Production Plan" to store the plan in the system</li>
              <li>Print for distribution to production team</li>
            </ol>
          </div>
        )}
      </div>

      {/* Main Forecast Display */}
      {forecasts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center print:hidden">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Forecast Generated</h3>
          <p className="text-gray-600">Click "Generate Forecast" to calculate production needs for tomorrow</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 print:shadow-none">
          {TIME_PERIODS.map(period => renderTimePeriodSection(period))}
          
          {/* Summary Statistics */}
          <div className="mt-8 pt-6 border-t border-gray-200 print:break-before-avoid">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIME_PERIODS.map(period => {
                const items = groupedForecasts[period.value]
                if (items.length === 0) return null
                
                const totalQty = items.reduce((sum, item) => {
                  return sum + (item.manual_override ?? item.forecast_quantity)
                }, 0)
                
                return (
                  <div key={period.value} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 font-medium">{period.label}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{totalQty} units</div>
                    <div className="text-xs text-gray-500 mt-1">{items.length} products</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print-view {
            padding: 0;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:table-cell {
            display: table-cell !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:mb-2 {
            margin-bottom: 0.5rem !important;
          }
          
          .print\\:mb-6 {
            margin-bottom: 1.5rem !important;
          }
          
          .break-inside-avoid {
            break-inside: avoid;
          }
          
          .print\\:break-before-avoid {
            break-before: avoid;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}

export default Forecast
