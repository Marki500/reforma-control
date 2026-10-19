import { useState, useEffect, useRef } from 'react'
import { analysisProblem } from '../utils/documentAnalysis'
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
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import {
  getBudgetPDFs,
  createBudgetPDF,
  deleteBudgetPDF,
  uploadPDF,
  updateBudgetPDF,
  acceptBudgetPDF,
  analyzeBudgetPDF,
  getAIUsage,
} from '../services/budgetPDFService'
import { getCategories } from '../services/materialsService'
import { getSuppliers } from '../services/suppliersService'
import BudgetPDFViewer from '../components/budget/BudgetPDFViewer'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { removeStoredFile } from '../services/storageCleanup'

const budgetStatuses = ['Solicitado', 'Recibido', 'Comparando', 'Aceptado', 'Rechazado']
const emptyMetadata = { name: '', category_id: '', supplier_id: '', notes: '', total_amount: '', issued_date: '', valid_until: '', status: 'Recibido', payment_terms: '', warranty: '' }
const normalizeName = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

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
  const [filterStatus, setFilterStatus] = useState('')
  const [uploadForm, setUploadForm] = useState({ file: null, ...emptyMetadata })
  const [analysisState, setAnalysisState] = useState('idle')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState('')
  const [aiUsage, setAiUsage] = useState(null)
  const [aiUsageError, setAiUsageError] = useState('')
  const [editingPdf, setEditingPdf] = useState(null)
  const [editForm, setEditForm] = useState(emptyMetadata)
  const [accepting, setAccepting] = useState(null)
  const [deletingPdf, setDeletingPdf] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    try {
      const [pdfsData, cats, supplierList, usageResult] = await Promise.all([
        getBudgetPDFs(),
        getCategories(),
        getSuppliers(),
        getAIUsage().then(data => ({ data })).catch(error => ({ error })),
      ])
      setPdfs(pdfsData)
      setCategories(cats)
      setSuppliers(supplierList.filter(item => item.status !== 'Archivado'))
      setAiUsage(usageResult.data || null)
      setAiUsageError(usageResult.error?.message || '')
    } catch (err) {
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function refreshAIUsage() {
    try { const usage = await getAIUsage(); setAiUsage(usage); setAiUsageError('') }
    catch (error) { setAiUsage(null); setAiUsageError(error.message || 'No se pudo consultar el contador gratuito.') }
  }

  function chooseFile(file) {
    if (!file || file.type !== 'application/pdf') return
    setUploadForm(previous => ({ ...previous, file, name: previous.name || file.name.replace(/\.pdf$/i, '') }))
    setAnalysisState('idle')
    setAnalysisResult(null)
    setAnalysisError('')
  }

  function openUpload() {
    setUploadForm({ file: null, ...emptyMetadata })
    setAnalysisState('idle')
    setAnalysisResult(null)
    setAnalysisError('')
    setUploadOpen(true)
  }

  async function analyzeUpload() {
    if (!uploadForm.file || analysisState === 'analyzing') return
    if (aiUsage && !aiUsage.allowed) {
      setAnalysisError(aiUsage.reason === 'user_limit' ? `Has agotado tus ${aiUsage.user_limit} usos gratuitos de IA de hoy.` : 'NIVEL ha agotado el cupo gratuito global de IA de hoy.')
      return
    }
    if (uploadForm.file.size > 14 * 1024 * 1024) {
      setAnalysisError('Para analizarlo con IA, el PDF debe ocupar como máximo 14 MB. Puedes rellenarlo manualmente.')
      return
    }
    setAnalysisState('analyzing')
    setAnalysisResult(null)
    setAnalysisError('')
    try {
      const result = await analyzeBudgetPDF(uploadForm.file)
      const draft = result.draft
      const problem = analysisProblem(draft, 'budget')
      if (problem) {
        setAnalysisResult(null)
        setAnalysisState('idle')
        setAnalysisError(problem)
        return
      }
      setAnalysisResult({ ...draft, model: result.model, reading_mode: result.reading_mode })
      const supplier = suppliers.find(item => normalizeName(item.name) === normalizeName(draft.supplier_name))
      const category = categories.find(item => {
        const categoryName = normalizeName(item.name)
        const suggestion = normalizeName(draft.suggested_category)
        return suggestion && (categoryName === suggestion || categoryName.includes(suggestion) || suggestion.includes(categoryName))
      })
      setUploadForm(previous => ({
        ...previous,
        name: draft.document_title || previous.name,
        supplier_id: supplier?.id || previous.supplier_id,
        category_id: category?.id || previous.category_id,
        notes: draft.notes || '',
        total_amount: draft.total_amount ?? '',
        issued_date: draft.issued_date || '',
        valid_until: draft.valid_until || '',
        payment_terms: draft.payment_terms || '',
        warranty: draft.warranty || '',
      }))
      setAnalysisState('ready')
    } catch (err) {
      setAnalysisState('idle')
      setAnalysisError(err.message || 'No se pudo analizar el presupuesto.')
    } finally { await refreshAIUsage() }
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!uploadForm.file) { setOperationError('Selecciona un archivo PDF.'); return }
    if (!['ready', 'manual'].includes(analysisState)) { setAnalysisError('Analiza el PDF o elige rellenarlo manualmente antes de guardarlo.'); return }
    setOperationError('')
    setUploading(true)
    let result
    try {
      result = await uploadPDF(uploadForm.file)
      await createBudgetPDF({
        name: uploadForm.name.trim() || uploadForm.file.name.replace(/\.pdf$/i, ''),
        file_url: result.url,
        file_size: result.size,
        category_id: uploadForm.category_id || null,
        supplier_id: uploadForm.supplier_id || null,
        notes: uploadForm.notes.trim(),
        total_amount: uploadForm.total_amount === '' ? null : Number(uploadForm.total_amount),
        issued_date: uploadForm.issued_date || null, valid_until: uploadForm.valid_until || null,
        status: uploadForm.status, payment_terms: uploadForm.payment_terms.trim(), warranty: uploadForm.warranty.trim(),
        quote_number: analysisState === 'ready' ? analysisResult?.quote_number || '' : '',
        subtotal: analysisState === 'ready' ? analysisResult?.subtotal : null,
        tax_rate: analysisState === 'ready' ? analysisResult?.tax_rate : null,
        tax_amount: analysisState === 'ready' ? analysisResult?.tax_amount : null,
        line_items: analysisState === 'ready' ? analysisResult?.line_items || [] : [],
        ai_extracted: analysisState === 'ready',
        ai_model: analysisState === 'ready' ? analysisResult?.model || '' : '',
      })
      await load()
      setUploadOpen(false)
    } catch (err) {
      if (result?.url) await removeStoredFile('budget-pdfs', result.url).catch(() => {})
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(pdf) {
    try {
      await deleteBudgetPDF(pdf)
      setPdfs((prev) => prev.filter((p) => p.id !== pdf.id))
      setDeletingPdf(null)
    } catch (err) {
      setOperationError(err.message || 'No se pudo completar la operación.')
      console.error(err)
    }
  }

  function editMetadata(pdf) {
    setEditingPdf(pdf)
    setEditForm({ ...emptyMetadata, name: pdf.name || '', category_id: pdf.category_id || '', supplier_id: pdf.supplier_id || '', notes: pdf.notes || '', total_amount: pdf.total_amount ?? '', issued_date: pdf.issued_date || '', valid_until: pdf.valid_until || '', status: pdf.status || 'Recibido', payment_terms: pdf.payment_terms || '', warranty: pdf.warranty || '' })
  }

  async function saveMetadata(event) {
    event.preventDefault()
    if (!editingPdf || uploading) return
    setUploading(true); setOperationError('')
    try {
      const updated = await updateBudgetPDF(editingPdf.id, { name: editForm.name.trim() || 'Presupuesto', category_id: editForm.category_id || null, supplier_id: editForm.supplier_id || null, notes: editForm.notes.trim(), total_amount: editForm.total_amount === '' ? null : Number(editForm.total_amount), issued_date: editForm.issued_date || null, valid_until: editForm.valid_until || null, status: editForm.status, payment_terms: editForm.payment_terms.trim(), warranty: editForm.warranty.trim() })
      setPdfs(previous => previous.map(pdf => pdf.id === updated.id ? updated : pdf))
      setEditingPdf(null)
    } catch (err) { setOperationError(err.message || 'No se pudo actualizar el presupuesto.') }
    finally { setUploading(false) }
  }

  async function accept(pdf) {
    if (accepting) return
    setAccepting(pdf.id); setOperationError('')
    try { await acceptBudgetPDF(pdf.id); await load() }
    catch (err) { setOperationError(err.message || 'No se pudo aceptar el presupuesto.') }
    finally { setAccepting(null) }
  }

  const filtered = pdfs.filter(pdf => (!filterCat || pdf.category_id === filterCat) && (!filterSupplier || pdf.supplier_id === filterSupplier) && (!filterStatus || pdf.status === filterStatus))

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

      {aiUsage && <div className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${aiUsage.allowed ? 'border-olive/20 bg-olive-light' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3"><span className={`rounded-xl p-2 ${aiUsage.allowed ? 'bg-white text-olive' : 'bg-white text-amber-700'}`}><Sparkles size={18} /></span><div><p className="text-sm font-semibold text-stone-800">IA gratuita</p><p className="text-xs text-stone-600">Has usado {aiUsage.user_used} de {aiUsage.user_limit} análisis hoy · Cupo global: {aiUsage.global_used} de {aiUsage.global_limit}</p></div></div>
        <span className="text-xs font-medium text-stone-500">Se reinicia a las 00:00</span>
      </div>}
      {aiUsageError && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-900">No se puede comprobar el cupo gratuito</p><p className="mt-1 text-xs text-amber-800">Por seguridad, NIVEL no enviará documentos a la IA hasta recuperar el contador.</p></div><Button type="button" size="sm" variant="secondary" onClick={refreshAIUsage}>Reintentar</Button></div>}

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
          <label className="block text-xs font-medium text-stone-500 sm:max-w-sm">Estado
            <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="mt-1 min-h-[42px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700"><option value="">Todos los estados</option>{budgetStatuses.map(status => <option key={status}>{status}</option>)}</select>
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
              <div className="mb-3 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-xs font-medium ${pdf.status === 'Aceptado' ? 'bg-green-100 text-green-700' : pdf.status === 'Rechazado' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'}`}>{pdf.status || 'Recibido'}</span>{pdf.total_amount != null && <span className="text-sm font-bold text-stone-800">{formatCurrency(pdf.total_amount)}</span>}{pdf.valid_until && <span className="text-xs text-stone-500">Válido hasta {new Date(`${pdf.valid_until}T12:00:00`).toLocaleDateString('es-ES')}</span>}</div>
              {pdf.status !== 'Aceptado' && pdf.status !== 'Rechazado' && <button type="button" onClick={() => accept(pdf)} disabled={accepting === pdf.id || !pdf.total_amount} className="mb-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-3 text-xs font-medium text-white disabled:opacity-40"><CheckCircle2 size={15} />{accepting === pdf.id ? 'Aceptando…' : 'Aceptar y crear gasto'}</button>}
              {pdf.expense_id && <button type="button" onClick={() => navigate('/gastos')} className="mb-3 text-xs font-medium text-olive hover:underline">Ver gasto asociado →</button>}

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
                  onClick={() => setDeletingPdf(pdf)}
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
                type="button"
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
              {analysisError && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{analysisError}</span></div>}

              {analysisState === 'idle' && uploadForm.file && (
                <div className="space-y-2">
                  <button type="button" onClick={analyzeUpload} disabled={aiUsage && !aiUsage.allowed} className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    <Sparkles size={17} /> {aiUsage && !aiUsage.allowed ? 'Límite gratuito agotado' : 'Analizar con IA'}
                  </button>
                  <button type="button" onClick={() => { setAnalysisState('manual'); setAnalysisError('') }} className="min-h-[40px] w-full text-xs font-medium text-stone-500 hover:text-stone-800">Rellenar manualmente</button>
                </div>
              )}
              {analysisState === 'analyzing' && <div className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-xl bg-stone-50 text-sm text-stone-600"><span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-terracotta" /><span>Leyendo texto, tablas e importes; si está escaneado, se analiza visualmente…</span></div>}

              {analysisState === 'ready' && analysisResult && (
                <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-800"><Sparkles size={16} /> Borrador generado · revísalo antes de guardar</div>
                  {analysisResult.reading_mode === 'vision' && <p className="text-xs text-green-800">PDF leído visualmente a partir de sus páginas.</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
                    {analysisResult.supplier_name && <div><span className="block text-stone-400">Proveedor detectado</span>{analysisResult.supplier_name}</div>}
                    {analysisResult.quote_number && <div><span className="block text-stone-400">N.º presupuesto</span>{analysisResult.quote_number}</div>}
                    {analysisResult.subtotal != null && <div><span className="block text-stone-400">Base</span>{formatCurrency(analysisResult.subtotal)}</div>}
                    {analysisResult.tax_amount != null && <div><span className="block text-stone-400">IVA {analysisResult.tax_rate != null ? `${analysisResult.tax_rate}%` : ''}</span>{formatCurrency(analysisResult.tax_amount)}</div>}
                  </div>
                  {analysisResult.line_items?.length > 0 && <details><summary className="cursor-pointer text-xs font-medium text-green-800">Ver {analysisResult.line_items.length} partidas detectadas</summary><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{analysisResult.line_items.map((item, index) => <div key={`${item.description}-${index}`} className="flex justify-between gap-3 border-t border-green-100 py-1.5 text-xs"><span>{item.description}{item.quantity != null ? ` · ${item.quantity} ${item.unit}` : ''}</span><strong className="shrink-0">{item.total != null ? formatCurrency(item.total) : '—'}</strong></div>)}</div></details>}
                  {analysisResult.warnings?.map(warning => <p key={warning} className="flex gap-1.5 text-xs text-amber-800"><AlertTriangle size={14} className="shrink-0" />{warning}</p>)}
                </div>
              )}

              {['ready', 'manual'].includes(analysisState) && <>
                <label className="block text-sm">Nombre<input value={uploadForm.name} onChange={event => setUploadForm(previous => ({ ...previous, name: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" placeholder="Ej. Presupuesto instalación eléctrica" /></label>
                <label className="block text-sm">Proveedor<select value={uploadForm.supplier_id} onChange={event => setUploadForm(previous => ({ ...previous, supplier_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin proveedor vinculado</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.trade}</option>)}</select>{analysisState === 'ready' && analysisResult?.supplier_name && !uploadForm.supplier_id && <span className="mt-1 block text-xs text-amber-700">“{analysisResult.supplier_name}” no coincide con un proveedor guardado. Puedes vincularlo después.</span>}</label>
                <label className="block text-sm">Categoría<select value={uploadForm.category_id} onChange={event => setUploadForm(previous => ({ ...previous, category_id: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"><option value="">Sin categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="block text-sm">Notas<textarea rows={2} value={uploadForm.notes} onChange={event => setUploadForm(previous => ({ ...previous, notes: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Importe total<input type="number" min="0" step="0.01" value={uploadForm.total_amount} onChange={event => setUploadForm(previous => ({ ...previous, total_amount: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Estado<select value={uploadForm.status} onChange={event => setUploadForm(previous => ({ ...previous, status: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm">{budgetStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">Fecha de emisión<input type="date" value={uploadForm.issued_date} onChange={event => setUploadForm(previous => ({ ...previous, issued_date: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Válido hasta<input type="date" value={uploadForm.valid_until} onChange={event => setUploadForm(previous => ({ ...previous, valid_until: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label></div>
                <label className="block text-sm">Forma de pago<input value={uploadForm.payment_terms} onChange={event => setUploadForm(previous => ({ ...previous, payment_terms: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Garantía<input value={uploadForm.warranty} onChange={event => setUploadForm(previous => ({ ...previous, warranty: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label>
                <button type="submit" disabled={uploading || !uploadForm.file} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-stone-700 px-4 text-sm font-medium text-white disabled:opacity-50">{uploading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{uploading ? 'Guardando…' : analysisState === 'ready' ? 'Aprobar borrador y guardar' : 'Guardar presupuesto'}</button>
              </>}
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
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Importe total<input type="number" min="0" step="0.01" value={editForm.total_amount} onChange={event => setEditForm(previous => ({ ...previous, total_amount: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Estado<select value={editForm.status} onChange={event => setEditForm(previous => ({ ...previous, status: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm">{budgetStatuses.map(status => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">Fecha de emisión<input type="date" value={editForm.issued_date} onChange={event => setEditForm(previous => ({ ...previous, issued_date: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Válido hasta<input type="date" value={editForm.valid_until} onChange={event => setEditForm(previous => ({ ...previous, valid_until: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label></div><label className="block text-sm">Forma de pago<input value={editForm.payment_terms} onChange={event => setEditForm(previous => ({ ...previous, payment_terms: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label><label className="block text-sm">Garantía<input value={editForm.warranty} onChange={event => setEditForm(previous => ({ ...previous, warranty: event.target.value }))} className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingPdf(null)} disabled={uploading}>Cancelar</Button><Button type="submit" disabled={uploading}>{uploading ? 'Guardando…' : 'Guardar'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deletingPdf)} title="Eliminar presupuesto" message={`¿Eliminar “${deletingPdf?.name || ''}”? También se borrará el PDF almacenado.`} onCancel={() => setDeletingPdf(null)} onConfirm={() => handleDelete(deletingPdf)} />
    </div>
  )
}
