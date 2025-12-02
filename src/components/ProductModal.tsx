import { useState, useEffect, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Product, DEPARTMENTS } from '../types'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (message: string) => void
  product?: Product | null // Optional product for edit mode
}

interface FormData {
  name: string
  category: string
  department: string
  cost_price: string
  sell_price: string
  shelf_life: string
  prep_time: string
  storage_type: string
}

interface ValidationErrors {
  name?: string
  category?: string
  department?: string
  cost_price?: string
  sell_price?: string
  shelf_life?: string
  prep_time?: string
}

const CATEGORIES = ['Breakfast', 'Lunch', 'Hot Food', 'Sandwiches', 'Bakery', 'Other']
const STORAGE_TYPES = ['Hot Cabinet', 'Chilled', 'Ambient']

function ProductModal({ isOpen, onClose, onSuccess, onError, product }: ProductModalProps) {
  const isEditMode = !!product

  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: '',
    department: 'Deli', // Default to Deli
    cost_price: '',
    sell_price: '',
    shelf_life: '',
    prep_time: '',
    storage_type: '',
  })

  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill form when editing
  useEffect(() => {
    if (product && isOpen) {
      setFormData({
        name: product.name,
        category: product.category,
        department: product.department || 'Deli',
        cost_price: product.cost_price.toString(),
        sell_price: product.sell_price.toString(),
        shelf_life: product.shelf_life?.toString() || '',
        prep_time: product.prep_time?.toString() || '',
        storage_type: product.storage_type || '',
      })
    } else if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        name: '',
        category: '',
        department: 'Deli',
        cost_price: '',
        sell_price: '',
        shelf_life: '',
        prep_time: '',
        storage_type: '',
      })
      setErrors({})
    }
  }, [product, isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    // Required: Product Name
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required'
    }

    // Required: Category
    if (!formData.category) {
      newErrors.category = 'Please select a category'
    }

    // Required: Department
    if (!formData.department) {
      newErrors.department = 'Please select a department'
    } else if (!DEPARTMENTS.includes(formData.department as any)) {
      newErrors.department = 'Please select a valid department'
    }

    // Required: Cost Price
    const costPrice = parseFloat(formData.cost_price)
    if (!formData.cost_price || isNaN(costPrice)) {
      newErrors.cost_price = 'Cost price is required'
    } else if (costPrice <= 0) {
      newErrors.cost_price = 'Cost price must be positive'
    }

    // Required: Sell Price
    const sellPrice = parseFloat(formData.sell_price)
    if (!formData.sell_price || isNaN(sellPrice)) {
      newErrors.sell_price = 'Sell price is required'
    } else if (sellPrice <= 0) {
      newErrors.sell_price = 'Sell price must be positive'
    } else if (sellPrice <= costPrice) {
      newErrors.sell_price = 'Sell price must be greater than cost price'
    }

    // Optional: Shelf Life (if provided, must be positive)
    if (formData.shelf_life) {
      const shelfLife = parseFloat(formData.shelf_life)
      if (isNaN(shelfLife) || shelfLife <= 0) {
        newErrors.shelf_life = 'Shelf life must be a positive number'
      }
    }

    // Optional: Prep Time (if provided, must be positive)
    if (formData.prep_time) {
      const prepTime = parseFloat(formData.prep_time)
      if (isNaN(prepTime) || prepTime <= 0) {
        newErrors.prep_time = 'Prep time must be a positive number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const productData: Partial<Product> = {
        name: formData.name.trim(),
        category: formData.category,
        department: formData.department,
        cost_price: parseFloat(formData.cost_price),
        sell_price: parseFloat(formData.sell_price),
        shelf_life: formData.shelf_life ? parseFloat(formData.shelf_life) : undefined,
        prep_time: formData.prep_time ? parseFloat(formData.prep_time) : undefined,
        storage_type: formData.storage_type || undefined,
      }

      if (isEditMode && product) {
        // UPDATE existing product
        const { error } = await supabase
          .from('products')
          .update({
            ...productData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id)

        if (error) throw error
      } else {
        // INSERT new product
        const { error } = await supabase
          .from('products')
          .insert([productData])

        if (error) throw error
      }

      // Reset form
      setFormData({
        name: '',
        category: '',
        department: 'Deli',
        cost_price: '',
        sell_price: '',
        shelf_life: '',
        prep_time: '',
        storage_type: '',
      })
      setErrors({})

      onSuccess()
      onClose()
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} product:`, err)
      onError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} product`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        category: '',
        department: 'Deli',
        cost_price: '',
        sell_price: '',
        shelf_life: '',
        prep_time: '',
        storage_type: '',
      })
      setErrors({})
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Product' : 'Add New Product'}
            </h3>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Chocolate Croissant"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                    errors.department ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a department</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department}</p>}
              </div>

              {/* Storage Type */}
              <div>
                <label htmlFor="storage_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Storage Type
                </label>
                <select
                  id="storage_type"
                  name="storage_type"
                  value={formData.storage_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                >
                  <option value="">Select storage type</option>
                  {STORAGE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Cost Price */}
              <div>
                <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 mb-2">
                  Cost Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input
                    type="number"
                    id="cost_price"
                    name="cost_price"
                    value={formData.cost_price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                      errors.cost_price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.cost_price && <p className="mt-1 text-sm text-red-600">{errors.cost_price}</p>}
              </div>

              {/* Sell Price */}
              <div>
                <label htmlFor="sell_price" className="block text-sm font-medium text-gray-700 mb-2">
                  Sell Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input
                    type="number"
                    id="sell_price"
                    name="sell_price"
                    value={formData.sell_price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                      errors.sell_price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.sell_price && <p className="mt-1 text-sm text-red-600">{errors.sell_price}</p>}
              </div>

              {/* Shelf Life */}
              <div>
                <label htmlFor="shelf_life" className="block text-sm font-medium text-gray-700 mb-2">
                  Shelf Life
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="shelf_life"
                    name="shelf_life"
                    value={formData.shelf_life}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                      errors.shelf_life ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="24"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">hours</span>
                </div>
                {errors.shelf_life && <p className="mt-1 text-sm text-red-600">{errors.shelf_life}</p>}
              </div>

              {/* Prep Time */}
              <div>
                <label htmlFor="prep_time" className="block text-sm font-medium text-gray-700 mb-2">
                  Prep Time
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="prep_time"
                    name="prep_time"
                    value={formData.prep_time}
                    onChange={handleChange}
                    step="1"
                    min="0"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${
                      errors.prep_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">minutes</span>
                </div>
                {errors.prep_time && <p className="mt-1 text-sm text-red-600">{errors.prep_time}</p>}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Product' : 'Create Product'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProductModal
