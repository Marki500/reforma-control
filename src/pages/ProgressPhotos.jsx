import { useEffect, useState } from 'react'
import { Camera, ImageOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { getRooms } from '../services/materialsService'
import { deleteProgressPhoto, getProgressPhotos, saveProgressPhoto, uploadProgressPhoto } from '../services/progressPhotosService'
import { filterProgressPhotos } from '../utils/progressPhotos'
import { localDateKey } from '../utils/tasks'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const phases = ['Antes', 'Durante', 'Después']
const empty = { title: '', phase: 'Durante', taken_date: localDateKey(), room_id: '', notes: '' }
const fieldClass = 'mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm'

export default function ProgressPhotos() {
  const [photos, setPhotos] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [filters, setFilters] = useState({ search: '', phase: '', room_id: '' })
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [preview, setPreview] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [items, roomList] = await Promise.all([getProgressPhotos(), getRooms()])
      setPhotos(items); setRooms(roomList)
    } catch (err) { setError(err.message || 'No se pudieron cargar las fotos.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const filtered = filterProgressPhotos(photos, filters)
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }))

  function edit(photo) {
    setEditing(photo || null)
    setForm(photo ? { title: photo.title, phase: photo.phase, taken_date: photo.taken_date, room_id: photo.room_id || '', notes: photo.notes || '' } : { ...empty, taken_date: localDateKey() })
    setFile(null); setFormError(''); setOpen(true)
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null
    if (selected && selected.size > 5 * 1024 * 1024) { setFile(null); setFormError('La imagen no puede superar 5 MB.'); return }
    setFile(selected); setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (!form.title.trim()) { setFormError('Escribe un título.'); return }
    if (!editing && !file) { setFormError('Selecciona una imagen.'); return }
    setBusy(true); setFormError('')
    try {
      let imageUrl = editing?.image_url
      if (!editing) imageUrl = (await uploadProgressPhoto(file)).url
      const saved = await saveProgressPhoto(editing?.id, form, imageUrl)
      setPhotos(previous => editing ? previous.map(item => item.id === saved.id ? saved : item) : [saved, ...previous])
      setOpen(false)
    } catch (err) { setFormError(err.message || 'No se pudo guardar la foto.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (busy || !deleting) return
    setBusy(true); setError('')
    try { await deleteProgressPhoto(deleting); setPhotos(previous => previous.filter(item => item.id !== deleting.id)); setDeleting(null) }
    catch (err) { setError(err.message || 'No se pudo eliminar la foto y su archivo.'); setDeleting(null) }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-stone-800">Progreso</h1><p className="mt-1 text-sm text-stone-500">Diario visual del antes, durante y después de la obra.</p></div><Button onClick={() => edit(null)} disabled={loading || Boolean(error)}><Plus size={16} /> Añadir foto</Button></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={load} className="underline">Reintentar</button></div>}
    <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3"><input aria-label="Buscar fotos" placeholder="Buscar fotos…" className={fieldClass} value={filters.search} onChange={event => setFilters(previous => ({ ...previous, search: event.target.value }))} /><select aria-label="Filtrar por fase" className={fieldClass} value={filters.phase} onChange={event => setFilters(previous => ({ ...previous, phase: event.target.value }))}><option value="">Todas las fases</option>{phases.map(value => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar por estancia" className={fieldClass} value={filters.room_id} onChange={event => setFilters(previous => ({ ...previous, room_id: event.target.value }))}><option value="">Todas las estancias</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
    {loading ? <p role="status">Cargando fotos…</p> : !error && filtered.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center text-stone-500"><Camera className="mx-auto mb-3" />{photos.length ? 'No hay fotos con estos filtros.' : 'Añade la primera foto del progreso.'}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(photo => <article key={photo.id} className="group overflow-hidden rounded-2xl bg-white shadow-sm">
      <button type="button" onClick={() => setPreview(photo)} className="block aspect-[4/3] w-full overflow-hidden bg-stone-100"><img src={photo.image_url} alt={photo.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" onError={event => { event.currentTarget.style.display = 'none' }} /></button>
      <div className="p-4"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-stone-800">{photo.title}</h2><span className="rounded-full bg-olive-light px-2 py-0.5 text-[11px] font-medium text-olive">{photo.phase}</span></div><p className="mt-1 text-xs text-stone-500">{new Date(`${photo.taken_date}T12:00:00`).toLocaleDateString('es-ES')}{photo.rooms?.name ? ` · ${photo.rooms.name}` : ''}</p></div><button aria-label={`Editar ${photo.title}`} className="p-1.5 text-stone-500" onClick={() => edit(photo)}><Pencil size={16} /></button><button aria-label={`Eliminar ${photo.title}`} className="p-1.5 text-stone-500" onClick={() => setDeleting(photo)}><Trash2 size={16} /></button></div>{photo.notes && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-stone-500">{photo.notes}</p>}</div>
    </article>)}</div>}
    <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? 'Editar foto' : 'Nueva foto de progreso'}><form onSubmit={submit} className="space-y-4">
      {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
      {!editing && <label className="block text-sm">Imagen<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className={fieldClass} onChange={chooseFile} /><span className="mt-1 block text-xs text-stone-400">JPG, PNG, WebP o AVIF · máximo 5 MB</span></label>}
      <label className="block text-sm">Título<input className={fieldClass} required maxLength={200} value={form.title} onChange={event => change('title', event.target.value)} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Fase<select className={fieldClass} value={form.phase} onChange={event => change('phase', event.target.value)}>{phases.map(value => <option key={value}>{value}</option>)}</select></label><label className="block text-sm">Fecha<input type="date" required className={fieldClass} value={form.taken_date} onChange={event => change('taken_date', event.target.value)} /></label><label className="block text-sm sm:col-span-2">Estancia<select className={fieldClass} value={form.room_id} onChange={event => change('room_id', event.target.value)}><option value="">Sin estancia</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label></div><label className="block text-sm">Descripción<textarea rows={3} className={fieldClass} value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? (editing ? 'Guardando…' : 'Subiendo…') : 'Guardar foto'}</Button></div>
    </form></Modal>
    <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)} title="Eliminar foto"><p className="mb-4 text-sm">¿Eliminar «{deleting?.title}»? También se borrará el archivo de imagen.</p><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Eliminar'}</Button></div></Modal>
    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title || 'Foto'}>{preview ? <div className="space-y-3"><img src={preview.image_url} alt={preview.title} className="max-h-[70vh] w-full rounded-xl object-contain" /><p className="text-sm text-stone-500">{preview.notes}</p></div> : <ImageOff />}</Modal>
  </div>
}
