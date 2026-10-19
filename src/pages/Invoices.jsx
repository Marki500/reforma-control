import { useEffect, useRef, useState } from 'react'
import { DocumentReview, ReviewChecks } from '../components/budget/DocumentReview'
import { documentReviewIssues } from '../utils/documentReview'
import { analysisProblem } from '../utils/documentAnalysis'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Upload, Sparkles, Eye, Trash2, Receipt, Search } from 'lucide-react'
import { getInvoices, analyzeInvoice, uploadInvoice, registerInvoice, getInvoiceFile, deleteInvoice, discardInvoiceUpload } from '../services/invoicesService'
import { getAIUsage, getBudgetPDFs } from '../services/budgetPDFService'
import { getExpenses } from '../services/expensesService'
import { getSuppliers } from '../services/suppliersService'
import { getRooms } from '../services/materialsService'
import { getWorkspaceContext } from '../services/workspaceService'
import { duplicateInvoice, expenseInvoice, invoiceCategories, invoiceMimeTypes, normalizeInvoiceKey, validateInvoice } from '../utils/invoices'
import { expenseStatus } from '../utils/expenses'
import { formatCurrency } from '../utils/formatCurrency'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const empty = { name: '', supplier_name: '', supplier_tax_id: '', supplier_id: '', invoice_number: '', issued_date: '', due_date: '', currency: 'EUR', subtotal: '', tax_rate: '', tax_amount: '', total_amount: '', paid_amount: '0', category: 'Material', room_id: '', expense_id: '', notes: '' }
const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-olive focus:ring-2 focus:ring-olive/15 disabled:bg-stone-100'
const numberValue = value => value == null ? '' : String(value)

export default function Invoices() {
  const [params] = useSearchParams()
  const [invoices, setInvoices] = useState([]), [expenses, setExpenses] = useState([]), [suppliers, setSuppliers] = useState([]), [rooms, setRooms] = useState([]), [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [query, setQuery] = useState(''), [status, setStatus] = useState('')
  const [open, setOpen] = useState(false), [form, setForm] = useState(empty), [file, setFile] = useState(null), [id, setId] = useState(''), [upload, setUpload] = useState(null)
  const [analysis, setAnalysis] = useState(null), [analysisError, setAnalysisError] = useState(''), [usage, setUsage] = useState(null)
  const [busy, setBusy] = useState(''), [reviewed, setReviewed] = useState(false), [formError, setFormError] = useState('')
  const [viewer, setViewer] = useState(null), [deleting, setDeleting] = useState(null)
  const fileInput = useRef(), operation = useRef(false)

  async function load() {
    setLoading(true); setLoadError('')
    try {
      const [items, costs, vendors, roomList, quotes, context] = await Promise.all([getInvoices(), getExpenses(), getSuppliers(), getRooms(), getBudgetPDFs(), getWorkspaceContext()])
      setInvoices(items); setExpenses(costs); setSuppliers(vendors); setRooms(roomList); setBudgets(quotes)
      setCanEdit(['owner', 'editor'].includes(context.role))
    } catch (err) { setLoadError(err.message || 'No se pudieron cargar las facturas.') }
    finally { setLoading(false) }
  }
  async function refreshUsage() { try { setUsage(await getAIUsage()) } catch { setUsage(null) } }
  useEffect(() => { load(); refreshUsage() }, [])

  function openUpload() {
    setForm({ ...empty }); setFile(null); setId(crypto.randomUUID()); setUpload(null); setAnalysis(null); setAnalysisError(''); setFormError(''); setReviewed(false); setOpen(true)
  }
  function chooseFile(selected) {
    if (!selected) return
    if (!invoiceMimeTypes.includes(selected.type) || selected.size > 20 * 1024 * 1024) { setFormError('Selecciona un PDF, JPG, PNG o WebP de hasta 20 MB.'); return }
    setFile(selected); setId(crypto.randomUUID()); setAnalysis(null); setAnalysisError(''); setFormError(''); setReviewed(false)
    setForm({ ...empty, name: selected.name.replace(/\.[^.]+$/, '').slice(0, 200) })
  }
  function change(key, value) { setForm(previous => ({ ...previous, [key]: value })); setReviewed(false) }
  async function closeUpload() {
    if (operation.current) return
    operation.current = true; setBusy('closing')
    try {
      if (upload) await discardInvoiceUpload(id, upload)
      setOpen(false); await load()
    } catch (err) { setFormError(err.message || 'No se pudo descartar el archivo. Puedes reintentar.') }
    finally { operation.current = false; setBusy('') }
  }
  async function analyze() {
    if (!file || operation.current) return
    if (file.size > 14 * 1024 * 1024) { setAnalysisError('Para analizar con IA, el documento debe ocupar hasta 14 MB. Puedes rellenarlo manualmente.'); return }
    operation.current = true; setBusy('analysis'); setAnalysis(null); setReviewed(false); setAnalysisError(''); setFormError('')
    try {
      const result = await analyzeInvoice(file), draft = result.draft
      const problem = analysisProblem(draft, 'invoice')
      if (problem) { setAnalysis(null); setAnalysisError(problem); return }
      const supplier = suppliers.find(item => item.status !== 'Archivado' && normalizeInvoiceKey(item.name) === normalizeInvoiceKey(draft.supplier_name))
      setForm(previous => ({ ...previous, name: draft.document_title || previous.name, supplier_name: draft.supplier_name || '', supplier_tax_id: draft.supplier_tax_id || '', supplier_id: supplier?.id || '', invoice_number: draft.invoice_number || '', issued_date: draft.issued_date || '', due_date: draft.due_date || '', currency: draft.currency || '', subtotal: numberValue(draft.subtotal), tax_rate: numberValue(draft.tax_rate), tax_amount: numberValue(draft.tax_amount), total_amount: numberValue(draft.total_amount), category: invoiceCategories.includes(draft.suggested_category) ? draft.suggested_category : previous.category, notes: draft.notes || '' }))
      setAnalysis({ ...draft, model: result.model }); setReviewed(false)
    } catch (err) { setAnalysisError(err.message || 'No se pudo analizar la factura. Puedes rellenarla manualmente.') }
    finally { operation.current = false; setBusy(''); refreshUsage() }
  }
  function selectExpense(value) {
    const target = expenses.find(item => item.id === value)
    setForm(previous => ({ ...previous, expense_id: value, expected_paid_amount: numberValue(target?.paid_amount ?? 0), paid_amount: numberValue(target?.paid_amount ?? 0), category: target?.category || previous.category, room_id: target?.room_id || '', due_date: target?.due_date || previous.due_date }))
    setReviewed(false)
  }
  const reviewIssues = documentReviewIssues(form, 'invoice')
  const fieldClass = key => `${inputClass} ${reviewIssues.some(issue => issue.field === key) ? '!border-amber-400 !bg-amber-50/40' : ''}`
  const duplicate = duplicateInvoice(invoices, form)
  async function save(event) {
    event.preventDefault()
    if (operation.current) return
    const validation = validateInvoice(form)
    if (!file || validation || !reviewed || (duplicate && duplicate.id !== id)) { setFormError(validation || (!file ? 'Selecciona el documento.' : duplicate ? 'Esta factura ya está registrada para el mismo proveedor.' : 'Confirma que has revisado los datos.')); return }
    operation.current = true; setBusy('save'); setFormError(''); setNotice('')
    try {
      const stored = upload?.ready ? upload : await uploadInvoice(file, id, prepared => setUpload({ ...prepared, ready: false }))
      setUpload({ ...stored, ready: true })
      await registerInvoice(form, stored, id, analysis)
      setOpen(false); setNotice(form.expense_id ? 'Factura registrada y gasto existente actualizado. No se ha creado otro gasto.' : 'Factura registrada. Ya está incluida en Gastos.'); await load()
    } catch (err) { setFormError(err.message || 'No se pudo registrar la factura. Reintenta con los mismos datos.') }
    finally { operation.current = false; setBusy('') }
  }
  async function view(item) {
    if (operation.current) return
    operation.current = true; setBusy(item.id); setError('')
    try { setViewer({ ...item, url: await getInvoiceFile(item) }) }
    catch (err) { setError(err.message || 'No se pudo abrir el documento.') }
    finally { operation.current = false; setBusy('') }
  }
  async function remove() {
    if (!deleting || operation.current) return
    operation.current = true; setBusy('delete'); setError('')
    try {
      const result = await deleteInvoice(deleting.id)
      setDeleting(null); setNotice(result.pending || result.error ? 'Factura retirada. El gasto se conserva y el archivo queda pendiente de limpieza en Ajustes.' : 'Factura retirada. El gasto y sus pagos se conservan.'); await load()
    } catch (err) { setError(err.message || 'No se pudo retirar la factura.') }
    finally { operation.current = false; setBusy('') }
  }
  const filtered = invoices.filter(item => (!params.get('invoice') || item.id === params.get('invoice')) && (!status || expenseStatus(item.expenses || {}) === status) && (!query || `${item.name} ${item.invoice_number} ${item.supplier_name} ${item.supplier_tax_id}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))))
  const total = filtered.reduce((sum, item) => sum + Number(item.total_amount), 0)
  const pending = filtered.reduce((sum, item) => sum + Math.max(Number(item.total_amount) - Number(item.expenses?.paid_amount || 0), 0), 0)
  const availableExpenses = expenses.filter(item => !expenseInvoice(item))

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold text-stone-800">Facturas</h1><p className="mt-1 text-sm text-stone-600">Guarda el documento y registra su importe en Gastos después de revisarlo.</p></div><Button onClick={openUpload} disabled={loading || Boolean(loadError) || !canEdit}><Upload size={17} />Subir factura</Button></div>
    {notice && <p role="status" className="rounded-xl bg-olive-light p-4 text-sm text-stone-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="py-12 text-center text-stone-600">Cargando facturas…</p> : loadError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}<button onClick={load} className="ml-3 font-semibold underline">Reintentar</button></div> : <>
      <div className="grid grid-cols-3 gap-3">{[['Facturas', filtered.length], ['Facturado', formatCurrency(total)], ['Pendiente', formatCurrency(pending)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-3 shadow-sm sm:p-5"><p className="text-xs text-stone-600">{label}</p><p className="mt-2 break-words text-lg font-bold tabular-nums text-stone-900 sm:text-2xl">{value}</p></div>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-3 top-3.5 text-stone-500" /><input aria-label="Buscar facturas" placeholder="Buscar por número, proveedor o concepto…" className={`${inputClass} !mt-0 pl-10`} value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrar facturas por pago" className={`${inputClass} !mt-0 sm:!w-auto`} value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos los pagos</option>{['Pendiente', 'Parcial', 'Pagado'].map(value => <option key={value}>{value}</option>)}</select></div>
      {params.get('invoice') && <Link to="/facturas" className="inline-block text-sm text-olive underline">Ver todas las facturas</Link>}
      {!filtered.length ? <div className="rounded-2xl bg-white px-6 py-12 text-center"><Receipt size={34} className="mx-auto mb-3 text-olive" /><h2 className="font-semibold text-stone-800">{invoices.length ? 'No hay facturas con estos filtros' : 'La documentación de tus gastos, en un sitio'}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-600">{invoices.length ? 'Prueba otra búsqueda o estado de pago.' : 'Sube un PDF o una foto, extrae los datos con IA o rellénalos manualmente y confirma el gasto. También puedes vincularlo a un presupuesto ya aceptado.'}</p>{!invoices.length && canEdit && <Button className="mt-5" onClick={openUpload}><Upload size={16} />Subir primera factura</Button>}</div> : <div className="space-y-3">{filtered.map(item => <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="shrink-0 rounded-xl bg-olive-light p-2.5 text-olive"><FileText size={21} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold text-stone-800">{item.name}</h2><span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">{expenseStatus(item.expenses || {})}</span></div><p className="mt-1 break-words text-sm text-stone-600">{item.supplier_name} · Nº {item.invoice_number}</p><p className="mt-2 text-xl font-bold tabular-nums text-stone-900">{formatCurrency(item.total_amount)}</p><p className="mt-1 text-xs text-stone-600">{new Date(`${item.issued_date}T12:00:00`).toLocaleDateString('es-ES')} · Pagado {formatCurrency(item.expenses?.paid_amount || 0)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => view(item)}><Eye size={16} />Ver factura</Button><Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-olive underline" to={`/gastos?expense=${item.expense_id}`}>Ver gasto</Link><button hidden={!canEdit} aria-label={`Retirar factura ${item.invoice_number}`} disabled={Boolean(busy)} onClick={() => setDeleting(item)} className="ml-auto rounded-xl p-3 text-stone-600 hover:bg-red-50 hover:text-red-700"><Trash2 size={17} /></button></div></article>)}</div>}
    </>}

    <Modal open={open} onClose={closeUpload} title="Revisar y registrar factura" wide={Boolean(file)}>
      <DocumentReview file={file}>
      <form onSubmit={save} className="space-y-5">
        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
        {upload && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Si falló la conexión, reintenta el registro con los mismos datos. Para corregirlos, cancela y vuelve a abrir la factura.</p>}
        <fieldset disabled={Boolean(busy) || Boolean(upload)} className="space-y-5 disabled:opacity-80">
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4"><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={event => chooseFile(event.target.files?.[0])} /><Button type="button" variant="secondary" className="w-full" onClick={() => fileInput.current?.click()}><Upload size={16} />{file ? 'Cambiar documento' : 'Seleccionar documento'}</Button>{file && <p className="mt-2 break-words text-sm text-stone-700">{file.name}</p>}<p className="mt-2 text-xs text-stone-600">PDF, JPG, PNG o WebP · Hasta 20 MB</p></div>
          <div className="space-y-2"><Button type="button" variant="olive" className="w-full" disabled={!file || usage?.allowed === false} onClick={analyze}><Sparkles size={16} />Analizar con IA</Button><p className="text-xs leading-relaxed text-stone-600">Opcional. Puedes rellenar los datos manualmente. El análisis utiliza la IA configurada para NIVEL y comparte el cupo con Presupuestos.</p>{usage && <p className="text-xs text-stone-600">{usage.user_used} de {usage.user_limit} análisis utilizados hoy · Cupo global: {usage.global_used} de {usage.global_limit}</p>}</div>
          {analysisError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{analysisError}</p>}
          {analysis?.warnings?.length > 0 && <ul className="list-inside list-disc rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{analysis.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          {file && <ReviewChecks values={form} kind="invoice" />}
          <label className="block text-sm font-medium text-stone-700">Concepto<input className={fieldClass('name')} required maxLength={200} value={form.name} onChange={event => change('name', event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-stone-700">Proveedor guardado<select className={inputClass} value={form.supplier_id} onChange={event => { const supplier = suppliers.find(item => item.id === event.target.value); setForm(previous => ({ ...previous, supplier_id: event.target.value, supplier_name: supplier?.name || previous.supplier_name })); setReviewed(false) }}><option value="">Sin asociar</option>{suppliers.filter(item => item.status !== 'Archivado').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block text-sm text-stone-700">Emisor de la factura<input className={fieldClass('supplier_name')} required maxLength={200} value={form.supplier_name} onChange={event => change('supplier_name', event.target.value)} /></label>
            <label className="block text-sm text-stone-700">NIF/CIF del emisor<input className={inputClass} maxLength={40} value={form.supplier_tax_id} onChange={event => change('supplier_tax_id', event.target.value)} /></label>
            <label className="block text-sm text-stone-700">Número de factura<input className={fieldClass('invoice_number')} required maxLength={100} value={form.invoice_number} onChange={event => change('invoice_number', event.target.value)} /></label>
            <label className="block text-sm text-stone-700">Fecha de emisión<input className={fieldClass('issued_date')} type="date" required value={form.issued_date} onChange={event => change('issued_date', event.target.value)} /></label>
            <label className="block text-sm text-stone-700">Vencimiento<input className={inputClass} type="date" value={form.due_date} onChange={event => change('due_date', event.target.value)} /></label>
            <label className="block text-sm text-stone-700">Moneda<select className={fieldClass('currency')} required value={form.currency} onChange={event => change('currency', event.target.value)}><option value="">Confirmar moneda</option><option value="EUR">EUR · Euro</option>{form.currency && form.currency !== 'EUR' && <option value={form.currency}>{form.currency} · No admitida</option>}</select></label>
            <label className="block text-sm text-stone-700">Categoría<select className={inputClass} value={form.category} onChange={event => change('category', event.target.value)}>{invoiceCategories.map(value => <option key={value}>{value}</option>)}</select></label>
            {[
              ['subtotal', 'Base imponible (€)'], ['tax_rate', 'IVA (%) · opcional'], ['tax_amount', 'IVA total (€)'], ['total_amount', 'Total factura (€)'],
            ].map(([key, label]) => <label key={key} className="block text-sm text-stone-700">{label}<input className={fieldClass(key)} aria-invalid={reviewIssues.some(issue => issue.field === key)} type="number" min="0" step="0.01" required={key === 'total_amount'} value={form[key]} onChange={event => change(key, event.target.value)} /></label>)}
            <label className="block text-sm text-stone-700">Estancia<select className={inputClass} value={form.room_id} onChange={event => change('room_id', event.target.value)}><option value="">Sin estancia</option>{rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className="space-y-3 rounded-xl bg-stone-50 p-4"><h3 className="text-sm font-semibold text-stone-800">Registrar en Gastos</h3><label className="block text-sm text-stone-700">Destino<select className={inputClass} value={form.expense_id} onChange={event => selectExpense(event.target.value)}><option value="">Crear un gasto nuevo</option>{availableExpenses.map(item => <option key={item.id} value={item.id}>{budgets.some(quote => quote.expense_id === item.id) ? 'Presupuesto aceptado · ' : ''}{item.title} · {formatCurrency(item.amount)}</option>)}</select></label>{form.expense_id ? <p className="text-xs leading-relaxed text-stone-600">Se actualizarán el concepto, proveedor e importe del gasto elegido. No se creará otro gasto. Comprueba que corresponde a esta factura; solo puede vincularse una factura por gasto.</p> : <p className="text-xs leading-relaxed text-stone-600">Si esta compra ya existe en Gastos o procede de un presupuesto aceptado, selecciona ese gasto para no duplicarlo.</p>}<label className="block text-sm text-stone-700">Pagado acumulado (€)<input className={inputClass} type="number" min="0" step="0.01" value={form.paid_amount} onChange={event => change('paid_amount', event.target.value)} /></label><p className="text-xs text-stone-600">Este importe sustituye el pagado del gasto; no se suma. Registrar una factura no la marca como pagada.</p></div>
          <label className="block text-sm text-stone-700">Notas<textarea className={inputClass} rows={3} maxLength={2000} value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
          {analysis?.line_items?.length > 0 && <details className="rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-sm font-medium text-stone-700">Partidas extraídas · {analysis.line_items.length}</summary><ul className="mt-3 space-y-2 text-xs text-stone-600">{analysis.line_items.map((item, index) => <li key={index}>{item.description}{item.total != null && ` · ${formatCurrency(item.total)}`}</li>)}</ul></details>}
        </fieldset>
        {busy === 'analysis' && <p role="status" className="text-sm text-olive">Analizando el documento… Puede tardar unos minutos.</p>}
        {duplicate && duplicate.id !== id && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ya existe la factura {duplicate.invoice_number} de este proveedor. Comprueba el registro antes de continuar.</p>}
        <label className="flex items-start gap-3 text-sm text-stone-700"><input type="checkbox" className="mt-1 h-4 w-4 accent-olive" checked={reviewed} disabled={Boolean(busy) || Boolean(upload)} onChange={event => setReviewed(event.target.checked)} />He revisado el documento, los importes y el gasto de destino.</label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={closeUpload}>Cancelar</Button><Button type="submit" disabled={Boolean(busy) || !file || !reviewed || Boolean(duplicate && duplicate.id !== id)}>{busy === 'save' ? 'Registrando…' : form.expense_id ? 'Registrar y actualizar gasto' : 'Registrar en gastos'}</Button></div>
      </form>
      </DocumentReview>
    </Modal>
    <Modal open={Boolean(viewer)} onClose={() => setViewer(null)} title={viewer?.name || 'Factura'}>{viewer && <div className="space-y-3">{viewer.file_type === 'application/pdf' ? <iframe title={`Factura ${viewer.invoice_number}`} src={viewer.url} className="h-[60dvh] w-full rounded-lg border border-stone-200" /> : <img alt={`Factura ${viewer.invoice_number} de ${viewer.supplier_name}`} src={viewer.url} className="max-h-[65dvh] w-full object-contain" />}<a href={viewer.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-olive underline">Abrir documento en otra pestaña</a></div>}</Modal>
    <ConfirmDialog open={Boolean(deleting)} title="Retirar factura" message={`Se retirará la factura ${deleting?.invoice_number || ''} y su archivo. El gasto y sus pagos se conservarán. Esta acción no se puede deshacer.`} confirmLabel="Retirar factura" busy={busy === 'delete'} onConfirm={remove} onCancel={() => !busy && setDeleting(null)} />
  </div>
}
