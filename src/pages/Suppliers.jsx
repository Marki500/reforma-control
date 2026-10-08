import { useEffect, useState } from 'react'
import { Building2, Globe, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { deleteSupplier, getSuppliers, saveSupplier } from '../services/suppliersService'
import { filterSuppliers } from '../utils/suppliers'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const trades = ['Albañilería', 'Electricidad', 'Fontanería', 'Carpintería', 'Pintura', 'Arquitectura', 'Tienda', 'Otro']
const statuses = ['Candidato', 'Activo', 'Archivado']
const empty = { name: '', trade: 'Otro', contact_person: '', phone: '', email: '', website: '', address: '', status: 'Activo', notes: '' }
const fieldClass = 'mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [filters, setFilters] = useState({ search: '', trade: '', status: '' })
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try { setSuppliers(await getSuppliers()) }
    catch (err) { setError(err.message || 'No se pudieron cargar los proveedores.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const filtered = filterSuppliers(suppliers, filters)
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }))

  function edit(supplier) {
    setEditing(supplier?.id || null); setForm(supplier ? { ...empty, ...supplier } : { ...empty })
    setFormError(''); setOpen(true)
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (!form.name.trim()) { setFormError('Escribe el nombre del proveedor o profesional.'); return }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { setFormError('El correo electrónico no parece válido.'); return }
    setBusy(true); setFormError('')
    try {
      const saved = await saveSupplier(editing, form)
      setSuppliers(previous => editing ? previous.map(item => item.id === saved.id ? saved : item) : [...previous, saved])
      setOpen(false)
    } catch (err) { setFormError(err.message || 'No se pudo guardar el proveedor.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (busy || !deleting) return
    setBusy(true); setError('')
    try { await deleteSupplier(deleting.id); setSuppliers(previous => previous.filter(item => item.id !== deleting.id)); setDeleting(null) }
    catch (err) { setError(err.message || 'No se pudo eliminar el proveedor.'); setDeleting(null) }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-stone-800">Proveedores</h1><p className="mt-1 text-sm text-stone-500">Profesionales, tiendas y empresas de la reforma.</p></div><Button onClick={() => edit(null)} disabled={loading || Boolean(error)}><Plus size={16} /> Añadir proveedor</Button></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={load} className="underline">Reintentar</button></div>}
    <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3">
      <input aria-label="Buscar proveedores" placeholder="Buscar nombre o contacto…" className={fieldClass} value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
      <select aria-label="Filtrar por especialidad" className={fieldClass} value={filters.trade} onChange={event => setFilters(prev => ({ ...prev, trade: event.target.value }))}><option value="">Todas las especialidades</option>{trades.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filtrar por estado" className={fieldClass} value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}><option value="">Todos los estados</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
    </div>
    {loading ? <p role="status">Cargando proveedores…</p> : !error && filtered.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center text-stone-500"><Building2 className="mx-auto mb-3" />{suppliers.length ? 'No hay proveedores con estos filtros.' : 'Añade tu primer profesional o tienda.'}</div> : <div className="grid gap-4 md:grid-cols-2">{filtered.map(supplier => <article key={supplier.id} className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-olive-light p-3 text-olive"><Building2 size={22} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold text-stone-800">{supplier.name}</h2><span className={`rounded-full px-2 py-0.5 text-xs ${supplier.status === 'Activo' ? 'bg-green-100 text-green-700' : supplier.status === 'Candidato' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>{supplier.status}</span></div><p className="mt-1 text-sm text-stone-500">{supplier.trade}</p></div><button aria-label={`Editar ${supplier.name}`} className="p-2 text-stone-500" onClick={() => edit(supplier)}><Pencil size={18} /></button><button aria-label={`Eliminar ${supplier.name}`} className="p-2 text-stone-500" onClick={() => setDeleting(supplier)}><Trash2 size={18} /></button></div>
      <div className="mt-4 space-y-2 text-sm text-stone-600">{supplier.contact_person && <p className="flex items-center gap-2"><UserRound size={15} />{supplier.contact_person}</p>}{supplier.phone && <a className="flex items-center gap-2 hover:underline" href={`tel:${supplier.phone}`}><Phone size={15} />{supplier.phone}</a>}{supplier.email && <a className="flex items-center gap-2 break-all hover:underline" href={`mailto:${supplier.email}`}><Mail size={15} />{supplier.email}</a>}{supplier.website && <a className="flex items-center gap-2 break-all hover:underline" href={supplier.website} target="_blank" rel="noreferrer"><Globe size={15} />{supplier.website}</a>}{supplier.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0" size={15} />{supplier.address}</p>}</div>
      {supplier.notes && <p className="mt-4 whitespace-pre-wrap border-t border-stone-100 pt-3 text-sm text-stone-500">{supplier.notes}</p>}
    </article>)}</div>}
    <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}><form onSubmit={submit} className="space-y-4">
      {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
      <label className="block text-sm">Nombre<input className={fieldClass} required maxLength={200} value={form.name} onChange={event => change('name', event.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Especialidad<select className={fieldClass} value={form.trade} onChange={event => change('trade', event.target.value)}>{trades.map(value => <option key={value}>{value}</option>)}</select></label><label className="block text-sm">Estado<select className={fieldClass} value={form.status} onChange={event => change('status', event.target.value)}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label><label className="block text-sm">Persona de contacto<input className={fieldClass} value={form.contact_person} onChange={event => change('contact_person', event.target.value)} /></label><label className="block text-sm">Teléfono<input type="tel" className={fieldClass} value={form.phone} onChange={event => change('phone', event.target.value)} /></label><label className="block text-sm">Correo<input type="email" className={fieldClass} value={form.email} onChange={event => change('email', event.target.value)} /></label><label className="block text-sm">Página web<input type="url" placeholder="https://…" className={fieldClass} value={form.website} onChange={event => change('website', event.target.value)} /></label></div>
      <label className="block text-sm">Dirección<input className={fieldClass} value={form.address} onChange={event => change('address', event.target.value)} /></label><label className="block text-sm">Notas<textarea rows={3} className={fieldClass} value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar proveedor'}</Button></div>
    </form></Modal>
    <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)} title="Eliminar proveedor"><p className="mb-4 text-sm">¿Eliminar «{deleting?.name}»? Los gastos asociados conservarán el nombre escrito.</p><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Eliminar'}</Button></div></Modal>
  </div>
}
