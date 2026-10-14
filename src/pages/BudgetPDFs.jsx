import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  FolderOpen,
  Plus,
  X,
  Building2,
  Pencil,
} from 'lucide-react'
import {
  getBudgetPDFs,
  createBudgetPDF,
  deleteBudgetPDF,
  uploadPDF,
  updateBudgetPDF,
} from '../services/budgetPDFService'
import { getCategories } from '../services/materialsService'
import { getSuppliers } from '../services/suppliersService'
import BudgetPDFViewer from '../components/budget/BudgetPDFViewer'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

export default function BudgetPDFs() {
  const [operationError, setOperationError] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pdfs, setPdfs] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerPdf, setViewerPdf] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [filterSupplier, setFilterSupplier] = useState(() => searchParams.get('supplier') || '')
  const [uploadForm, setUploadForm] = useState({ file: null, name: '', category_id: '', supplier_id: '', notes: '' })
  const [editingPdf, setEditingPdf] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category_id: '', supplier_id: '', notes: '' })
  const fileRef = useRef()

  const load = async () => {
    try {
      const [pdfsData, cats, supplierList] = await Promise.all([
        getBudgetPDFs(),
        getCategories(),
        getSuppliers(),
      ])
      setPdfs(pdfsData)
      setCategories(cats)
      setSuppliers(supplierList.filter(item => item.status !== 'Archivado'))
    } catch (err) {
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function chooseFile(file) {
    if (!file || file.type !== 'application/pdf') return
    setUploadForm(previous => ({ ...previous, file, name: previous.name || file.name.replace(/\.pdf$/i, '') }))
  }

  function openUpload() {
    setUploadForm({ file: null, name: '', category_id: '', supplier_id: '', notes: '' })
    setUploadOpen(true)
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!uploadForm.file) { setOperationError('Selecciona un archivo PDF.'); return }
    setOperationError('')
    setUploading(true)
    try {
      const result = await uploadPDF(uploadForm.file)
      await createBudgetPDF({
        name: uploadForm.name.trim() || uploadForm.file.name.replace(/\.pdf$/i, ''),
        file_url: result.url,
        file_size: result.size,
        category_id: uploadForm.category_id || null,
        supplier_id: uploadForm.supplier_id || null,
        notes: uploadForm.notes.trim(),
      })
      await load()
      setUploadOpen(false)
    } catch (err) {
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este presupuesto?')) return
    try {
      await deleteBudgetPDF(id)
      setPdfs((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    }
  }

  function editMetadata(pdf) {
    setEditingPdf(pdf)
    setEditForm({ name: pdf.name || '', category_id: pdf.category_id || '', supplier_id: pdf.supplier_id || '', notes: pdf.notes || '' })
  }

  async function saveMetadata(event) {
    event.preventDefault()
    if (!editingPdf || uploading) return
    setUploading(true); setOperationError('')
    try {
      const updated = await updateBudgetPDF(editingPdf.id, { name: editForm.name.trim() || 'Presupuesto', category_id: editForm.category_id || null, supplier_id: editForm.supplier_id || null, notes: editForm.notes.trim() })
      setPdfs(previous => previous.map(pdf => pdf.id === updated.id ? updated : pdf))
      setEditingPdf(null)
    } catch (err) { setOperationError(err.message || 'No se pudo actualizar el presupuesto.') }
    finally { setUploading(false) }
  }

  const filtered = pdfs.filter(pdf => (!filterCat || pdf.category_id === filterCat) && (!filterSupplier || pdf.supplier_id === filterSupplier))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-8">
      {operationError && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-lg">{operationError}<button type="button" onClick={() => setOperationError('')} className="ml-3 font-semibold underline">Cerrar</button></div>}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">
            Presupuestos recibidos
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Tus presupuestos en PDF organizados por categoría
          </p>
        </div>
        <button
          onClick={openUpload}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-stone-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-stone-800 sm:w-auto"
        >
          <Plus size={16} />
          Subir PDF
        </button>
      </div>

      {pdfs.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterCat('')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              !filterCat
                ? 'bg-stone-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(cat.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                filterCat === cat.id
                  ? 'bg-stone-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
          </div>
          <label className="block text-xs font-medium text-stone-500 sm:max-w-sm">Proveedor
            <select value={filterSupplier} onChange={event => setFilterSupplier(event.target.value)} className="mt-1 min-h-[42px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700">
              <option value="">Todos los proveedores</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.trade}</option>)}
            </select>
          </label>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <FileText size={48} className="mx-auto mb-4 text-stone-200" />
          <p className="text-sm text-stone-500">
            {pdfs.length === 0
              ? 'Aún no has subido ningún presupuesto'
              : 'No hay presupuestos en esta categoría'}
          </p>
          {pdfs.length === 0 && (
            <button
              onClick={openUpload}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-stone-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-stone-800"
            >
              <Upload size={16} />
              Subir primer presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pdf) => (
            <div
              key={pdf.id}
              className="group rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-terracotta-light">
                    <FileText size={18} className="text-terracotta" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {pdf.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {pdf.material_categories?.name || 'Sin categoría'}
                      {pdf.file_size
                        ? ` · ${(pdf.file_size / 1024 / 1024).toFixed(1)} MB`
                        : ''}
                    </p>
                    {pdf.suppliers?.name && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-olive"><Building2 size={12} />{pdf.suppliers.name}</p>}
                  </div>
                </div>
              </div>

              <p className="mb-3 text-xs text-stone-400">
                {new Date(pdf.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewerPdf(pdf)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
                >
                  <Eye size={14} />
                  Ver
                </button>
                <a
                  href={pdf.file_url}
                  download={pdf.name}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
                >
                  <Upload size={14} />
                  Descargar
                </a>
                <button
                  onClick={() => editMetadata(pdf)}
                  aria-label={`Editar ${pdf.name}`}
                  className="flex items-center justify-center rounded-xl border border-stone-200 px-3 py-2 text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(pdf.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setUploadOpen(false)}
        >
          <form onSubmit={handleUpload} className="max-h-[calc(100dvh-0.75rem)] w-full max-w-md overflow-y-auto rounded-t-[1.5rem] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-800">
                Subir presupuesto
              </h2>
              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X size={20} />
              </button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                chooseFile(e.dataTransfer.files[0])
              }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 px-6 py-10 text-center transition-colors hover:border-stone-400 hover:bg-stone-50"
            >
              {uploadForm.file ? <FileText size={32} className="text-terracotta" /> : <Upload size={32} className="text-stone-300" />}
              <div>
                <p className="text-sm font-medium text-stone-700">
                  {uploadForm.file ? uploadForm.file.name : 'Haz clic o arrastra un PDF aquí'}
                </p>
                <p className="text-xs text-stone-400">{uploadForm.file ? `${(uploadForm.file.size / 1024 / 1024).toFixed(1)} MB · Pulsa para cambiar` : 'PDF hasta 20 MB'}</p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                chooseFile(file)
              }}
              disabled={uploading}
            />
            <div className="mt-4 space-y-3">
              <label className="block text-sm">Nombre<input value={uploadForm.name} onChange={event => setUploadForm(previous => ({ ...previous, name: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" placeholder="Ej. Presupuesto instalación eléctrica" /></label>
              <label className="block text-sm">Proveedor<select value={uploadForm.supplier_id} onChange={event => setUploadForm(previous => ({ ...previous, supplier_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin proveedor vinculado</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.trade}</option>)}</select></label>
              <label className="block text-sm">Categoría<select value={uploadForm.category_id} onChange={event => setUploadForm(previous => ({ ...previous, category_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="block text-sm">Notas<textarea rows={2} value={uploadForm.notes} onChange={event => setUploadForm(previous => ({ ...previous, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
              <button type="submit" disabled={uploading || !uploadForm.file} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-stone-700 px-4 text-sm font-medium text-white disabled:opacity-50">{uploading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{uploading ? 'Subiendo…' : 'Guardar presupuesto'}</button>
            </div>
          </form>
        </div>
      )}

      <BudgetPDFViewer pdf={viewerPdf} onClose={() => setViewerPdf(null)} />
      <Modal open={Boolean(editingPdf)} onClose={() => !uploading && setEditingPdf(null)} title="Editar presupuesto">
        <form onSubmit={saveMetadata} className="space-y-4">
          <label className="block text-sm">Nombre<input required value={editForm.name} onChange={event => setEditForm(previous => ({ ...previous, name: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
          <label className="block text-sm">Proveedor<select value={editForm.supplier_id} onChange={event => setEditForm(previous => ({ ...previous, supplier_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin proveedor vinculado</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.trade}</option>)}</select></label>
          <label className="block text-sm">Categoría<select value={editForm.category_id} onChange={event => setEditForm(previous => ({ ...previous, category_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="block text-sm">Notas<textarea rows={3} value={editForm.notes} onChange={event => setEditForm(previous => ({ ...previous, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingPdf(null)} disabled={uploading}>Cancelar</Button><Button type="submit" disabled={uploading}>{uploading ? 'Guardando…' : 'Guardar'}</Button></div>
        </form>
      </Modal>
    </div>
  )
}
