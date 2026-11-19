import { normalizeStorageRecord } from '../utils/storageUrl'
import { isOptimizedMaterialImage } from '../utils/materialImages'
import { measureRead, materialsDiagnosticReport } from '../utils/materialsDiagnostics'
import MaterialsDiagnostics from '../components/materials/MaterialsDiagnostics'
import { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { getCurrentProjectId } from '../services/workspaceService'
import {
  createMaterial,
  updateMaterial,
  updateMaterialStatus,
  deleteMaterial,
  uploadImage,
  optimizeSavedMaterialImage,
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
import { removeStoredFile } from '../services/storageCleanup'
import { materialEstimate } from '../utils/dashboardFinance'
import {
  Package,
  LayoutGrid,
  Table2,
  Plus,
  ExternalLink,
  Search,
} from 'lucide-react'

export default function Materials() {
  const [operationError, setOperationError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')

  const deferredSearch = useDeferredValue(searchQuery)
  const [page, setPage] = useState(1)
  const pageSize = 24

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
  const [purchasingId, setPurchasingId] = useState(null)
  const [purchaseNotice, setPurchaseNotice] = useState(null)
  const purchaseRequest = useRef(false)

  const [imageOptimization, setImageOptimization] = useState(null)
  const [imageNotice, setImageNotice] = useState('')
  const [imageFailures, setImageFailures] = useState([])
  const loadMetrics = useRef(null)
  const imageMetrics = useRef(new Map())
  const mainThread = useRef({ supported: false, count: 0, total_ms: 0, longest_ms: 0 })
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) return
    mainThread.current.supported = true
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        mainThread.current.count++
        mainThread.current.total_ms += Math.round(entry.duration)
        mainThread.current.longest_ms = Math.max(mainThread.current.longest_ms, Math.round(entry.duration))
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
    return () => observer.disconnect()
  }, [])

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadData = useCallback(async () => {
    const started = performance.now()
    const timings = {}
    loadMetrics.current = null
    try {
      setLoading(true)
      setLoadError('')
      const [materialsData, categoriesData, roomsData] = await Promise.all([
        measureRead('materials_ms', () => supabase
          .from('materials')
          .select('*, rooms(name), material_categories(name)')
          .order('created_at', { ascending: false }), timings),
        measureRead('categories_ms', getCategories, timings),
        measureRead('rooms_ms', getRooms, timings),
      ])

      if (materialsData.error) throw materialsData.error
      setMaterials((materialsData.data || []).map(normalizeStorageRecord))
      setCategories(categoriesData || [])
      setRooms(roomsData || [])
    } catch (err) {
      setLoadError(err.message || 'No se pudieron cargar los materiales. Comprueba la conexión e inténtalo de nuevo.')
      console.error('Error loading materials:', err)
    } finally {
      loadMetrics.current = { started_ms: Math.round(started), ...timings, total_ms: Math.round(performance.now() - started) }
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

  // Filter materials client-side for search
  const matchingMaterials = useMemo(() => {
    const q = deferredSearch.toLowerCase()
    return materials.filter((m) => {
      if (filters.category_id && m.category_id !== filters.category_id) return false
      if (filters.room_id && m.room_id !== filters.room_id) return false
      if (filters.priority && m.priority !== filters.priority) return false
      if (q) {
        const match =
          (m.name || '').toLowerCase().includes(q) ||
          (m.brand || '').toLowerCase().includes(q) ||
          (m.model || '').toLowerCase().includes(q) ||
          (m.store_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [materials, filters.category_id, filters.room_id, filters.priority, deferredSearch])

  const statusCounts = useMemo(() => ({
    '': matchingMaterials.length,
    Comprado: matchingMaterials.filter(material => material.status === 'Comprado').length,
    Recibido: matchingMaterials.filter(material => material.status === 'Recibido').length,
  }), [matchingMaterials])
  const filteredMaterials = useMemo(() => filters.status
    ? matchingMaterials.filter(material => material.status === filters.status)
    : matchingMaterials, [matchingMaterials, filters.status])

  useEffect(() => { setPage(1) }, [filters, deferredSearch])
  const pageCount = Math.max(1, Math.ceil(filteredMaterials.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleMaterials = filteredMaterials.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculate total (only materials with count_in_total)
  const totalCost = useMemo(() => filteredMaterials.reduce(
    (sum, m) => sum + materialEstimate(m),
    0
  ), [filteredMaterials])

  async function handleSave(formData, imageFile) {
    if (imageOptimization || purchaseRequest.current) return
    setOperationError('')
    setSaving(true)
    let uploadedImageUrl = null
    try {
      const projectId = await getCurrentProjectId()

      let mainImageUrl = formData.main_image_url

      if (imageFile || (mainImageUrl && !isOptimizedMaterialImage(mainImageUrl))) {
        mainImageUrl = await uploadImage(imageFile || mainImageUrl)
        uploadedImageUrl = mainImageUrl
      }

      const materialPayload = {
        ...formData,
        category_id: formData.category_id || null,
        room_id: formData.room_id || null,
        project_id: projectId,
        main_image_url: mainImageUrl,
      }

      let saved
      if (editingMaterial?.id) {
        saved = await updateMaterial(editingMaterial.id, materialPayload)
        // An automatically converted source may still be used by a duplicate.
        if (imageFile && uploadedImageUrl && editingMaterial.main_image_url !== uploadedImageUrl) await removeStoredFile('material-images', editingMaterial.main_image_url).catch(() => {})
      } else {
        saved = await createMaterial(materialPayload)
        setPage(1)
      }

      const record = normalizeStorageRecord(saved)
      setMaterials(previous => editingMaterial?.id
        ? previous.map(item => item.id === record.id ? record : item)
        : [record, ...previous])
      setFormOpen(false)
      setEditingMaterial(null)
    } catch (err) {
      // A network error may arrive after the record was saved. Preserve its image.
      if (uploadedImageUrl && /^[0-9A-Z]{5}$/.test(err.code || '')) await removeStoredFile('material-images', uploadedImageUrl).catch(() => {})
      setOperationError(err.message || 'No se pudo guardar el material.')
      console.error('Error saving material:', err)
    } finally {
      setSaving(false)
    }
  }

  const imagesToOptimize = useMemo(() => materials.filter(item => item.main_image_url && !isOptimizedMaterialImage(item.main_image_url)), [materials])

  function collectDiagnostic() {
    return { main_thread: { ...mainThread.current }, ...materialsDiagnosticReport({ load: loadMetrics.current, images: [...imageMetrics.current.values()], failures: imageFailures,
      materialCount: materials.length, pageCount, resources: performance.getEntriesByType('resource') }) }
  }

  function recordImage(event) {
    const image = event.target
    if (image.tagName !== 'IMG') return
    const url = image.currentSrc || image.src
    const resource = performance.getEntriesByName(url).at(-1)
    let host = ''
    try { host = new URL(url).hostname } catch {}
    imageMetrics.current.set(url, { name: image.alt, host, failed: event.type === 'error', ms: resource ? Math.round(resource.duration) : null })
  }

  async function handleOptimizeImages() {
    if (imageOptimization || saving || purchaseRequest.current) return
    const targets = [...imagesToOptimize]
    if (!targets.length) return
    setImageOptimization({ done: 0, total: targets.length })
    setImageNotice('')
    setImageFailures([])
    const failures = []
    let failed = 0
    for (const [index, material] of targets.entries()) {
      try {
        const result = await optimizeSavedMaterialImage(material.id)
        const record = normalizeStorageRecord(result.material)
        setMaterials(previous => previous.map(item => item.id === record.id ? { ...item, main_image_url: record.main_image_url } : item))
      } catch (error) {
        failed++
        failures.push({ material: material.name, reason: error.message || 'Error desconocido', status: error.status || null, stage: error.stage || null, request_id: error.requestId || null })
      }
      setImageOptimization({ done: index + 1, total: targets.length })
    }
    setImageOptimization(null)
    setImageFailures(failures)
    setImageNotice(failed
      ? `Se han procesado ${targets.length - failed} imágenes. No se pudieron optimizar ${failed}; Revisa el motivo debajo antes de reintentar o subir otra imagen.`
      : 'Las imágenes de los materiales ya están optimizadas y guardadas en tu almacenamiento.')
  }

  async function handleDelete(material) {
    if (!imageOptimization && !purchaseRequest.current) setConfirmDelete(material)
  }

  async function confirmDeleteMaterial() {
    if (!confirmDelete || imageOptimization || purchaseRequest.current) return
    try {
      await deleteMaterial(confirmDelete)
      setMaterials(previous => previous.filter(item => item.id !== confirmDelete.id))
      setConfirmDelete(null)
      setPurchaseNotice(previous => previous?.id === confirmDelete.id ? null : previous)
    } catch (err) {
      setOperationError(err.message || 'No se pudo eliminar el material y su archivo.')
      console.error('Error deleting material:', err)
    }
  }

  async function handlePurchase(material, undo = false) {
    if (purchaseRequest.current || imageOptimization || saving || formOpen || confirmDelete) return
    if (!undo && ['Comprado', 'Recibido'].includes(material.status)) return
    const previousStatus = undo ? purchaseNotice?.previousStatus : material.status ?? null
    if (undo && purchaseNotice?.id !== material.id) return
    purchaseRequest.current = true
    setPurchasingId(material.id)
    setOperationError('')
    try {
      const saved = await updateMaterialStatus(material.id, undo ? previousStatus : 'Comprado', undo ? 'Comprado' : previousStatus)
      setMaterials(previous => previous.map(item => item.id === saved.id ? { ...item, status: saved.status } : item))
      setPurchaseNotice(undo ? null : { id: material.id, name: material.name, previousStatus })
    } catch (error) {
      setOperationError(error.message || 'No se pudo actualizar el estado de compra.')
    } finally {
      purchaseRequest.current = false
      setPurchasingId(null)
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
      setOperationError(err.message || 'No se pudo actualizar el material.')
      console.error('Error toggling count_in_total:', err)
    }
  }

  function handleDuplicate(material) {
    if (imageOptimization || purchaseRequest.current) return
    const { id, created_at, user_id, ...rest } = material
    setEditingMaterial({
      ...rest,
      name: `${rest.name} (copia)`,
      price: rest.price || '',
    })
    setFormOpen(true)
  }

  function handleEdit(material) {
    if (imageOptimization || purchaseRequest.current) return
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
    <div className="mx-auto max-w-6xl space-y-6" onLoadCapture={recordImage} onErrorCapture={recordImage}>
      {operationError && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-lg">{operationError}<button type="button" onClick={() => setOperationError('')} className="ml-3 font-semibold underline">Cerrar</button></div>}
      {purchaseNotice && <div role="status" className="fixed bottom-24 left-4 right-4 z-[70] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-white p-4 text-sm text-stone-700 shadow-lg lg:bottom-5">
        <span className="min-w-0 flex-1 break-words"><strong>{purchaseNotice.name}</strong> marcado como comprado.</span>
        <button type="button" disabled={Boolean(purchasingId) || Boolean(imageOptimization) || saving || formOpen || Boolean(confirmDelete)} onClick={() => handlePurchase(purchaseNotice, true)} className="min-h-11 px-2 font-semibold text-olive underline disabled:opacity-50">Deshacer</button>
        <button type="button" aria-label="Cerrar confirmación de compra" onClick={() => setPurchaseNotice(null)} className="min-h-11 px-2 text-stone-500">Cerrar</button>
      </div>}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Materiales</h1>
          <p className="mt-1 text-sm text-stone-500">
            {loadError ? 'Importes no disponibles' : `${filteredMaterials.length} materiales · ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(totalCost)} estimados`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(imageOptimization)}
            onClick={() => setImportModalOpen(true)}
          >
            <ExternalLink size={16} />
            <span>Importar URL</span>
          </Button>
          <Button
            size="sm"
            disabled={Boolean(imageOptimization)}
            onClick={() => {
              setEditingMaterial(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} />
            <span>Añadir</span>
          </Button>
        </div>
      </div>

      {!loading && !loadError && (imagesToOptimize.length > 0 || imageOptimization || imageNotice) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-600">
            <p>Guarda copias ligeras de las imágenes para cargar los materiales más rápido.</p>
            {imageNotice && <p role="status" className="mt-1">{imageNotice}</p>}
            {imageFailures.length > 0 && <ul className="mt-2 space-y-2">{imageFailures.map((failure, index) => <li key={index} className="break-words"><strong>{failure.material}:</strong> {failure.reason}</li>)}</ul>}
            {imageOptimization && <p role="status" className="mt-1">Optimizando {imageOptimization.done} de {imageOptimization.total}… Mantén esta pantalla abierta.</p>}
          </div>
          {imagesToOptimize.length > 0 && <Button variant="secondary" size="sm" disabled={Boolean(imageOptimization) || saving || formOpen || Boolean(confirmDelete)} onClick={handleOptimizeImages}>Optimizar imágenes ({imagesToOptimize.length})</Button>}
        </div>
      )}

      <section aria-label="Buscar y filtrar materiales" className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" /><input type="search" aria-label="Buscar dentro de materiales" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Buscar dentro de materiales…" className="min-h-[44px] w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-terracotta" /></div>

        {/* View toggle */}
        <div className="hidden shrink-0 items-center gap-1 rounded-xl bg-stone-100 p-1 sm:flex">
          <button
            type="button"
            aria-label="Vista de tarjetas"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
            className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive ${
              viewMode === 'cards'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            aria-label="Vista de tabla"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive ${
              viewMode === 'table'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Table2 size={18} />
          </button>
        </div>

        </div>
        <MaterialsFilters
          categories={categories}
          rooms={rooms}
          filters={filters}
          onChange={setFilters}
          onClear={() =>
            setFilters({ category_id: '', room_id: '', status: '', priority: '' })
          }
        />
        {!loading && !loadError && (
          <div role="group" aria-label="Filtrar materiales por estado" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-flex">
            {[['', 'Todos'], ['Comprado', 'Comprados'], ['Recibido', 'Recibidos']].map(([status, label]) => (
              <button
                key={status}
                type="button"
                aria-pressed={filters.status === status}
                onClick={() => setFilters(previous => ({ ...previous, status }))}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive sm:gap-2 sm:px-4 sm:text-sm ${filters.status === status ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {label}
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${filters.status === status ? 'bg-olive-light text-stone-700' : 'bg-stone-200/60'}`}>{statusCounts[status]}</span>
              </button>
            ))}
          </div>
        )}

      </section>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <h2 className="font-semibold">No se pudieron cargar los materiales</h2>
          <p className="mt-2">{loadError}</p>
          <button type="button" onClick={loadData} className="mt-4 rounded-lg border border-red-300 px-4 py-2 font-semibold hover:bg-red-100">Reintentar</button>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="rounded-2xl bg-white p-7 text-center shadow-sm sm:p-12">
          <Package size={48} className="mx-auto mb-4 text-stone-300" />
          <h2 className="text-lg font-semibold text-stone-700">No hay materiales</h2>
          <p className="mt-1 text-sm text-stone-500">
            {searchQuery || Object.values(filters).some(Boolean)
              ? 'No se encontraron materiales con estos filtros'
              : 'Empieza añadiendo tu primer material'}
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="secondary"
              disabled={Boolean(imageOptimization)}
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
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleCount={handleToggleCount}
              onDuplicate={handleDuplicate}
              onPurchase={handlePurchase}
              purchasePending={purchasingId === material.id}
              purchaseDisabled={Boolean(purchasingId) || Boolean(imageOptimization) || saving || formOpen || Boolean(confirmDelete)}
            />
          ))}
        </div>
      ) : (
        <MaterialsTable
          materials={visibleMaterials}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleCount={handleToggleCount}
          onDuplicate={handleDuplicate}
          onPurchase={handlePurchase}
          purchasingId={purchasingId}
          purchaseDisabled={Boolean(purchasingId) || Boolean(imageOptimization) || saving || formOpen || Boolean(confirmDelete)}
        />
      )}

      {!loading && !loadError && filteredMaterials.length > pageSize && (
        <nav aria-label="Paginación de materiales" className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
          <p role="status" className="text-sm text-stone-600">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredMaterials.length)} de {filteredMaterials.length} materiales</p>
          <Button variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
        </nav>
      )}

      <MaterialsDiagnostics collect={collectDiagnostic} />

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
