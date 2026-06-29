import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  FolderOpen,
  Plus,
  X,
} from 'lucide-react'
import {
  getBudgetPDFs,
  createBudgetPDF,
  deleteBudgetPDF,
  uploadPDF,
} from '../services/budgetPDFService'
import { getCategories } from '../services/materialsService'
import BudgetPDFViewer from '../components/budget/BudgetPDFViewer'

export default function BudgetPDFs() {
  const navigate = useNavigate()
  const [pdfs, setPdfs] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerPdf, setViewerPdf] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const fileRef = useRef()

  const load = async () => {
    try {
      const [pdfsData, cats] = await Promise.all([
        getBudgetPDFs(),
        getCategories(),
      ])
      setPdfs(pdfsData)
      setCategories(cats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadPDF(file)
      const name = file.name.replace(/\.pdf$/i, '')
      await createBudgetPDF({
        name,
        file_url: result.url,
        file_size: result.size,
      })
      await load()
      setUploadOpen(false)
    } catch (err) {
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
      console.error(err)
    }
  }

  const filtered = filterCat
    ? pdfs.filter((p) => p.category_id === filterCat)
    : pdfs

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">
            Presupuestos recibidos
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Tus presupuestos en PDF organizados por categoría
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-stone-800"
        >
          <Plus size={16} />
          Subir PDF
        </button>
      </div>

      {pdfs.length > 0 && (
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
              onClick={() => setUploadOpen(true)}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setUploadOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
                const file = e.dataTransfer.files[0]
                if (file?.type === 'application/pdf') handleUpload(file)
              }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 px-6 py-10 text-center transition-colors hover:border-stone-400 hover:bg-stone-50"
            >
              <Upload size={32} className="text-stone-300" />
              <div>
                <p className="text-sm font-medium text-stone-700">
                  Haz clic o arrastra un PDF aquí
                </p>
                <p className="text-xs text-stone-400">PDF hasta 20 MB</p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
              disabled={uploading}
            />

            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
                Subiendo...
              </div>
            )}
          </div>
        </div>
      )}

      <BudgetPDFViewer pdf={viewerPdf} onClose={() => setViewerPdf(null)} />
    </div>
  )
}
