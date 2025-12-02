import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import Badge from '../components/Badge'
import { Category, Department, BADGE_COLORS, BadgeColor } from '../types'

interface ToastState {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

interface CategoryFormData {
  name: string
  color: BadgeColor
  active: boolean
}

interface DepartmentFormData {
  name: string
  color: BadgeColor
  active: boolean
}

function Settings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' })

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    color: 'gray',
    active: true,
  })
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  // Department modal state
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormData>({
    name: '',
    color: 'gray',
    active: true,
  })
  const [isSavingDepartment, setIsSavingDepartment] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [categoriesRes, departmentsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
      ])

      if (categoriesRes.error) throw categoriesRes.error
      if (departmentsRes.error) throw departmentsRes.error

      setCategories(categoriesRes.data || [])
      setDepartments(departmentsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type })
  }

  // Category functions
  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({
        name: category.name,
        color: category.color as BadgeColor,
        active: category.active,
      })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', color: 'gray', active: true })
    }
    setIsCategoryModalOpen(true)
  }

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false)
    setEditingCategory(null)
    setCategoryForm({ name: '', color: 'gray', active: true })
  }

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      showToast('Category name is required', 'error')
      return
    }

    setIsSavingCategory(true)
    try {
      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('categories')
          .update(categoryForm)
          .eq('id', editingCategory.id)

        if (error) throw error
        showToast('Category updated successfully', 'success')
      } else {
        // Create
        const { error } = await supabase
          .from('categories')
          .insert([categoryForm])

        if (error) throw error
        showToast('Category created successfully', 'success')
      }

      await fetchData()
      closeCategoryModal()
    } catch (error: any) {
      console.error('Error saving category:', error)
      if (error.message?.includes('duplicate') || error.code === '23505') {
        showToast('A category with this name already exists', 'error')
      } else {
        showToast('Failed to save category', 'error')
      }
    } finally {
      setIsSavingCategory(false)
    }
  }

  const deleteCategory = async (category: Category) => {
    // Check if any products use this category
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id)

    if (countError) {
      showToast('Failed to check category usage', 'error')
      return
    }

    if (count && count > 0) {
      showToast(`Cannot delete: ${count} product${count !== 1 ? 's' : ''} are using this category`, 'error')
      return
    }

    if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)

      if (error) throw error

      showToast('Category deleted successfully', 'success')
      await fetchData()
    } catch (error) {
      console.error('Error deleting category:', error)
      showToast('Failed to delete category', 'error')
    }
  }

  // Department functions
  const openDepartmentModal = (department?: Department) => {
    if (department) {
      setEditingDepartment(department)
      setDepartmentForm({
        name: department.name,
        color: department.color as BadgeColor,
        active: department.active,
      })
    } else {
      setEditingDepartment(null)
      setDepartmentForm({ name: '', color: 'gray', active: true })
    }
    setIsDepartmentModalOpen(true)
  }

  const closeDepartmentModal = () => {
    setIsDepartmentModalOpen(false)
    setEditingDepartment(null)
    setDepartmentForm({ name: '', color: 'gray', active: true })
  }

  const saveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      showToast('Department name is required', 'error')
      return
    }

    setIsSavingDepartment(true)
    try {
      if (editingDepartment) {
        // Update
        const { error } = await supabase
          .from('departments')
          .update(departmentForm)
          .eq('id', editingDepartment.id)

        if (error) throw error
        showToast('Department updated successfully', 'success')
      } else {
        // Create
        const { error } = await supabase
          .from('departments')
          .insert([departmentForm])

        if (error) throw error
        showToast('Department created successfully', 'success')
      }

      await fetchData()
      closeDepartmentModal()
    } catch (error: any) {
      console.error('Error saving department:', error)
      if (error.message?.includes('duplicate') || error.code === '23505') {
        showToast('A department with this name already exists', 'error')
      } else {
        showToast('Failed to save department', 'error')
      }
    } finally {
      setIsSavingDepartment(false)
    }
  }

  const deleteDepartment = async (department: Department) => {
    // Check if any products use this department
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', department.id)

    if (countError) {
      showToast('Failed to check department usage', 'error')
      return
    }

    if (count && count > 0) {
      showToast(`Cannot delete: ${count} product${count !== 1 ? 's' : ''} are using this department`, 'error')
      return
    }

    if (!confirm(`Are you sure you want to delete the department "${department.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', department.id)

      if (error) throw error

      showToast('Department deleted successfully', 'success')
      await fetchData()
    } catch (error) {
      console.error('Error deleting department:', error)
      showToast('Failed to delete department', 'error')
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
          <p className="mt-2 text-gray-600">Manage categories and departments</p>
        </div>
        <div className="bg-white rounded-lg shadow p-12 flex justify-center items-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading settings...</p>
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
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="mt-2 text-gray-600">Manage categories and departments for your products</p>
      </div>

      {/* Categories Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Categories</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manage product categories ({categories.length} total)
            </p>
          </div>
          <button
            onClick={() => openCategoryModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No categories</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first category</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Color Preview</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {category.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge label={category.name} color={category.color as BadgeColor} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {category.active ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openCategoryModal(category)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCategory(category)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Departments Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Departments</h3>
            <p className="mt-1 text-sm text-gray-600">
              Manage business departments ({departments.length} total)
            </p>
          </div>
          <button
            onClick={() => openDepartmentModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Department
          </button>
        </div>

        {departments.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No departments</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first department</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Color Preview</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {departments.map((department) => (
                  <tr key={department.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {department.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge label={department.name} color={department.color as BadgeColor} hasBorder />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {department.active ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openDepartmentModal(department)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <svg className="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteDepartment(department)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeCategoryModal}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={closeCategoryModal}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g., Breakfast"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value as BadgeColor })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    {BADGE_COLORS.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <Badge label={categoryForm.name || 'Preview'} color={categoryForm.color} />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categoryForm.active}
                      onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Inactive categories won't appear in product dropdowns
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={closeCategoryModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCategory}
                  disabled={isSavingCategory}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {isSavingCategory ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {isDepartmentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeDepartmentModal}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingDepartment ? 'Edit Department' : 'Add Department'}
                </h3>
                <button
                  onClick={closeDepartmentModal}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={departmentForm.name}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="e.g., Deli"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={departmentForm.color}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value as BadgeColor })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    {BADGE_COLORS.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <Badge label={departmentForm.name || 'Preview'} color={departmentForm.color} hasBorder />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={departmentForm.active}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Inactive departments won't appear in product dropdowns
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={closeDepartmentModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDepartment}
                  disabled={isSavingDepartment}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {isSavingDepartment ? 'Saving...' : (editingDepartment ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings

