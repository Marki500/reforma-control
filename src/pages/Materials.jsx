import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import {
  createMaterial,
  updateMaterial,
  deleteMaterial,
  uploadImage,
  getCategories,
  getRooms,
  toggleCountInTotal,
} from '../services/materialsService'
import MaterialCard from '../components/materials/MaterialCard'
import MaterialsTable from '../components/materials/MaterialsTable'
import MaterialsFilters from '../components/materials/MaterialsFilters'
import MaterialForm from '../components/materials/MaterialForm'
import ImportFromUrlModal from '../components/materials/ImportFromUrlModal'
import { Modal } from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import {
  Package,
  LayoutGrid,
  Table2,
  Plus,
  ExternalLink,
} from 'lucide-react'

export default function Materials() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { searchQuery } = useOutletContext()

  const [materials, setMaterials] = useState([])
  const [categories, setCategories] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('cards')
  const [filters, setFilters] = useState({
    category_id: '',
    room_id: '',
    status: '',
    priority: '',
  })

  const [formOpen, setFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [saving, setSaving] = useState(false)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [materialsData, categoriesData, roomsData] = await Promise.all([
        supabase
          .from('materials')
          .select('*, rooms(name), material_categories(name)')
          .order('created_at', { ascending: false }),
        getCategories(),
        getRooms(),
      ])

      setMaterials(materialsData.data || [])
      setCategories(categoriesData || [])
      setRooms(roomsData || [])
    } catch (err) {
      console.error('Error loading materials:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle URL params for quick actions
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add') {
      setEditingMaterial(null)
      setFormOpen(true)
      setSearchParams({})
    } else if (action === 'import') {
      setImportModalOpen(true)
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // Apply search from header
  const combinedFilters = { ...filters }
  if (searchQuery) {
    combinedFilters.search = searchQuery
  }

  // Filter materials client-side for search
  const filteredMaterials = materials.filter((m) => {
    if (filters.category_id && m.category_id !== filters.category_id) return false
    if (filters.room_id && m.room_id !== filters.room_id) return false
    if (filters.status && m.status !== filters.status) return false
    if (filters.priority && m.priority !== filters.priority) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match =
        (m.name || '').toLowerCase().includes(q) ||
        (m.brand || '').toLowerCase().includes(q) ||
        (m.model || '').toLowerCase().includes(q) ||
        (m.store_name || '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  // Calculate total (only materials with count_in_total)
  const totalCost = filteredMaterials.reduce(
    (sum, m) => sum + (m.count_in_total !== false ? (m.price || 0) * (m.quantity || 1) : 0),
    0
  )

  async function handleSave(formData, imageFile) {
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      let mainImageUrl = formData.main_image_url

      if (imageFile) {
        mainImageUrl = await uploadImage(imageFile, userData.user.id)
      }

      const materialPayload = {
        ...formData,
        category_id: formData.category_id || null,
        room_id: formData.room_id || null,
        user_id: userData.user.id,
        main_image_url: mainImageUrl,
      }

      if (editingMaterial?.id) {
        await updateMaterial(editingMaterial.id, materialPayload)
      } else {
        await createMaterial(materialPayload)
      }

      setFormOpen(false)
      setEditingMaterial(null)
      await loadData()
    } catch (err) {
      console.error('Error saving material:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(material) {
    setConfirmDelete(material)
  }

  async function confirmDeleteMaterial() {
    if (!confirmDelete) return
    try {
      await deleteMaterial(confirmDelete.id)
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting material:', err)
    }
  }

  async function handleToggleCount(material) {
    try {
      const newValue = material.count_in_total === false ? true : false
      await toggleCountInTotal(material.id, newValue)
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, count_in_total: newValue } : m))
      )
    } catch (err) {
      console.error('Error toggling count_in_total:', err)
    }
  }

  function handleDuplicate(material) {
    const { id, created_at, user_id, ...rest } = material
    setEditingMaterial({
      ...rest,
      name: `${rest.name} (copia)`,
      price: rest.price || '',
    })
    setFormOpen(true)
  }

  function handleEdit(material) {
    setEditingMaterial(material)
    setFormOpen(true)
  }

  function handleImportResult(data) {
    setImportModalOpen(false)
    setEditingMaterial({
      name: data.name || '',
      brand: data.brand || '',
      model: data.model || '',
      price: data.price || '',
      currency: data.currency || 'EUR',
      store_name: data.storeName || '',
      product_url: data.productUrl || '',
      main_image_url: data.image || '',
      description: data.description || '',
      availability: data.availability || '',
    })
    setFormOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Materiales</h1>
          <p className="mt-1 text-sm text-stone-500">
            {filteredMaterials.length} materiales ·{' '}
            {new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            }).format(totalCost)}{' '}
            total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setImportModalOpen(true)}
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">Importar URL</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingMaterial(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Añadir</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <MaterialsFilters
        categories={categories}
        rooms={rooms}
        filters={filters}
        onChange={setFilters}
        onClear={() =>
          setFilters({ category_id: '', room_id: '', status: '', priority: '' })
        }
      />

      {/* View toggle */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setViewMode('cards')}
          className={`rounded-lg p-2 transition-colors ${
            viewMode === 'cards'
              ? 'bg-stone-200 text-stone-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <LayoutGrid size={18} />
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`rounded-lg p-2 transition-colors ${
            viewMode === 'table'
              ? 'bg-stone-200 text-stone-700'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Table2 size={18} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <Package size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-lg font-semibold text-stone-700">No hay materiales</h2>
          <p className="mt-1 text-sm text-stone-500">
            {searchQuery
              ? 'No se encontraron materiales con esa búsqueda'
              : 'Empieza añadiendo tu primer material'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setImportModalOpen(true)}
            >
              <ExternalLink size={16} />
              Importar desde URL
            </Button>
            <Button
              onClick={() => {
                setEditingMaterial(null)
                setFormOpen(true)
              }}
            >
              <Plus size={16} />
              Añadir material
            </Button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleCount={handleToggleCount}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
        <MaterialsTable
          materials={filteredMaterials}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleCount={handleToggleCount}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Material Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingMaterial(null)
        }}
        title={editingMaterial ? 'Editar material' : 'Nuevo material'}
      >
        <MaterialForm
          initial={editingMaterial}
          categories={categories}
          rooms={rooms}
          onSave={handleSave}
          onCancel={() => {
            setFormOpen(false)
            setEditingMaterial(null)
          }}
          saving={saving}
        />
      </Modal>

      {/* Import URL Modal */}
      <ImportFromUrlModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportResult}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar material"
        message={`¿Eliminar "${confirmDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={confirmDeleteMaterial}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
