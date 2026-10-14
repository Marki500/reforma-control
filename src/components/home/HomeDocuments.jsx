import { useEffect, useState } from 'react'
import { Download, FilePlus2, FileText, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { createHomeDocument, deleteHomeDocument, getHomeDocuments, uploadHomeDocument } from '../../services/homeDocumentsService'

const types = ['Cédula de habitabilidad', 'Certificado energético', 'Escritura o nota simple', 'Catastro', 'ITE / IEE', 'Licencia de obra', 'Seguro', 'Contrato de suministro', 'Garantía', 'Otro']
const empty = { title: '', document_type: types[0], document_date: '', expiry_date: '', notes: '' }
const fieldClass = 'mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm'

export default function HomeDocuments() {
  const [documents, setDocuments] = useState([]), [open, setOpen] = useState(false), [form, setForm] = useState(empty)
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [deleting, setDeleting] = useState(null)
  useEffect(() => { getHomeDocuments().then(setDocuments).catch(err => setError(err.message)) }, [])
  async function submit(event) {
    event.preventDefault(); if (!file || busy) return; setBusy(true); setError('')
    try { const upload = await uploadHomeDocument(file); const saved = await createHomeDocument(form, upload); setDocuments(previous => [saved, ...previous]); setOpen(false); setForm(empty); setFile(null) }
    catch (err) { setError(err.message || 'No se pudo guardar el documento.') } finally { setBusy(false) }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true)
    try { await deleteHomeDocument(deleting); setDocuments(previous => previous.filter(item => item.id !== deleting.id)); setDeleting(null) }
    catch (err) { setError(err.message || 'No se pudo eliminar el documento.') } finally { setBusy(false) }
  }
  return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-stone-800">Archivo de documentos</h2><p className="mt-1 text-xs text-stone-500">PDF o imágenes de certificados, licencias, contratos y garantías.</p></div><Button type="button" size="sm" onClick={() => setOpen(true)}><FilePlus2 size={16} />Adjuntar documento</Button></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 space-y-2">{documents.length === 0 ? <div className="rounded-xl bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">Aún no hay documentos adjuntos.</div> : documents.map(document => <article key={document.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3"><span className="rounded-lg bg-terracotta-light p-2 text-terracotta"><FileText size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-stone-800">{document.title}</p><p className="text-xs text-stone-500">{document.document_type}{document.expiry_date ? ` · Caduca ${new Date(`${document.expiry_date}T12:00:00`).toLocaleDateString('es-ES')}` : ''}</p></div>{document.access_url && <a href={document.access_url} target="_blank" rel="noreferrer" aria-label={`Abrir ${document.title}`} className="rounded-lg p-2 text-stone-500"><Download size={17} /></a>}<button type="button" onClick={() => setDeleting(document)} aria-label={`Eliminar ${document.title}`} className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></article>)}</div>
    <Modal open={open} onClose={() => !busy && setOpen(false)} title="Adjuntar documento"><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Archivo<input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${fieldClass} file:mr-3 file:border-0 file:bg-transparent`} onChange={event => setFile(event.target.files?.[0] || null)} /></label><label className="block text-sm">Nombre<input required className={fieldClass} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></label><label className="block text-sm">Tipo<select className={fieldClass} value={form.document_type} onChange={event => setForm(previous => ({ ...previous, document_type: event.target.value }))}>{types.map(type => <option key={type}>{type}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Fecha del documento<input type="date" className={fieldClass} value={form.document_date} onChange={event => setForm(previous => ({ ...previous, document_date: event.target.value }))} /></label><label className="block text-sm">Caducidad<input type="date" className={fieldClass} value={form.expiry_date} onChange={event => setForm(previous => ({ ...previous, expiry_date: event.target.value }))} /></label></div><label className="block text-sm">Notas<textarea rows={2} className={fieldClass} value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} /></label><Button type="submit" className="w-full" disabled={busy || !file}>{busy ? 'Subiendo…' : 'Guardar documento'}</Button></form></Modal>
    <ConfirmDialog open={Boolean(deleting)} title="Eliminar documento" message={`¿Eliminar “${deleting?.title || ''}”? También se borrará el archivo.`} onCancel={() => setDeleting(null)} onConfirm={remove} />
  </section>
}
