import { useEffect, useState } from 'react'
import { Building2, FileBadge2, Home, MapPin, Pencil, PlugZap, Save } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { getHomeInfo, saveHomeInfo } from '../services/homeInfoService'
import HomeDocuments from '../components/home/HomeDocuments'
import { getWorkspaceContext } from '../services/workspaceService'

const empty = {
  address: '', postal_code: '', city: '', province: '', property_type: '', cadastral_reference: '',
  construction_year: '', built_area: '', usable_area: '', bedrooms: '', bathrooms: '',
  electricity_cups: '', gas_cups: '', water_contract: '',
  habitability_certificate_number: '', habitability_certificate_date: '', habitability_certificate_expiry: '',
  energy_certificate_number: '', energy_rating: '', energy_certificate_expiry: '',
  community_contact: '', insurance_policy: '', notes: '',
}
const inputClass = 'mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-terracotta/70 focus:ring-2 focus:ring-terracotta/10 disabled:border-stone-100 disabled:bg-stone-50 disabled:text-stone-600'

function Section({ icon: Icon, title, description, children }) {
  return <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60 sm:p-6">
    <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-olive-light p-2.5 text-olive"><Icon size={20} /></span><div><h2 className="font-semibold text-stone-800">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-stone-500">{description}</p></div></div>
    {children}
  </section>
}

export default function HomeInfo() {
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [role, setRole] = useState('viewer')
  const change = (key, value) => { setSaved(false); setForm(previous => ({ ...previous, [key]: value })) }

  useEffect(() => {
    Promise.all([getHomeInfo(), getWorkspaceContext()]).then(([data, context]) => {
      setRole(context?.role || 'viewer')
      if (data) setForm({ ...empty, ...data })
      else if (context?.role !== 'viewer') setEditing(true)
    }).catch(err => setError(err.message || 'No se pudo cargar la información de la vivienda.')).finally(() => setLoading(false))
  }, [])

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try { const result = await saveHomeInfo(form); setForm({ ...empty, ...result }); setEditing(false); setSaved(true) }
    catch (err) { setError(err.message || 'No se pudo guardar la información.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" /></div>

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-terracotta">Ficha del inmueble</p><h1 className="text-2xl font-semibold text-stone-800">Información de la vivienda</h1><p className="mt-1 text-sm text-stone-500">Datos importantes de la casa, contratos y documentación.</p></div>{editing ? <Button type="submit" form="home-info-form" disabled={saving}><Save size={16} />{saving ? 'Guardando…' : 'Guardar cambios'}</Button> : role === 'viewer' ? <span className="rounded-xl bg-stone-200 px-3 py-2 text-sm text-stone-500">Acceso de solo lectura</span> : <Button type="button" variant="secondary" onClick={() => setEditing(true)}><Pencil size={16} />Editar información</Button>}</div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {saved && <div role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">Información guardada correctamente.</div>}

    <form id="home-info-form" onSubmit={submit} className="space-y-5">

    <Section icon={MapPin} title="Identificación y ubicación" description="Dirección y datos que identifican legalmente la vivienda."><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Dirección<input disabled={!editing} className={inputClass} value={form.address} onChange={e => change('address', e.target.value)} placeholder="Calle, número, piso y puerta" /></label><label className="text-sm">Código postal<input disabled={!editing} className={inputClass} value={form.postal_code} onChange={e => change('postal_code', e.target.value)} /></label><label className="text-sm">Municipio<input disabled={!editing} className={inputClass} value={form.city} onChange={e => change('city', e.target.value)} /></label><label className="text-sm">Provincia<input disabled={!editing} className={inputClass} value={form.province} onChange={e => change('province', e.target.value)} /></label><label className="text-sm">Tipo de vivienda<input disabled={!editing} className={inputClass} value={form.property_type} onChange={e => change('property_type', e.target.value)} placeholder="Piso, casa, adosado…" /></label><label className="text-sm sm:col-span-2">Referencia catastral<input disabled={!editing} className={`${inputClass} uppercase`} value={form.cadastral_reference} onChange={e => change('cadastral_reference', e.target.value)} /></label></div></Section>

    <Section icon={Home} title="Características" description="Información básica que suele pedirse para presupuestos y certificados."><div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><label className="text-sm">Año de construcción<input disabled={!editing} type="number" min="1500" max="2200" className={inputClass} value={form.construction_year ?? ''} onChange={e => change('construction_year', e.target.value)} /></label><label className="text-sm">Superficie construida (m²)<input disabled={!editing} type="number" min="0" step="0.01" className={inputClass} value={form.built_area ?? ''} onChange={e => change('built_area', e.target.value)} /></label><label className="text-sm">Superficie útil (m²)<input disabled={!editing} type="number" min="0" step="0.01" className={inputClass} value={form.usable_area ?? ''} onChange={e => change('usable_area', e.target.value)} /></label><label className="text-sm">Habitaciones<input disabled={!editing} type="number" min="0" className={inputClass} value={form.bedrooms ?? ''} onChange={e => change('bedrooms', e.target.value)} /></label><label className="text-sm">Baños<input disabled={!editing} type="number" min="0" className={inputClass} value={form.bathrooms ?? ''} onChange={e => change('bathrooms', e.target.value)} /></label></div></Section>

    <Section icon={PlugZap} title="Suministros" description="Identificadores necesarios para gestiones con las compañías."><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">CUPS electricidad<input disabled={!editing} className={`${inputClass} uppercase`} value={form.electricity_cups} onChange={e => change('electricity_cups', e.target.value)} placeholder="ES…" /></label><label className="text-sm">CUPS gas<input disabled={!editing} className={`${inputClass} uppercase`} value={form.gas_cups} onChange={e => change('gas_cups', e.target.value)} placeholder="ES…" /></label><label className="text-sm sm:col-span-2">Contrato o referencia del agua<input disabled={!editing} className={inputClass} value={form.water_contract} onChange={e => change('water_contract', e.target.value)} /></label></div></Section>

    <Section icon={FileBadge2} title="Documentación" description="Referencias y fechas de los documentos de la vivienda."><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm sm:col-span-3">Número de cédula de habitabilidad<input disabled={!editing} className={inputClass} value={form.habitability_certificate_number} onChange={e => change('habitability_certificate_number', e.target.value)} /></label><label className="text-sm">Fecha de expedición<input disabled={!editing} type="date" className={inputClass} value={form.habitability_certificate_date || ''} onChange={e => change('habitability_certificate_date', e.target.value)} /></label><label className="text-sm">Caducidad de la cédula<input disabled={!editing} type="date" className={inputClass} value={form.habitability_certificate_expiry || ''} onChange={e => change('habitability_certificate_expiry', e.target.value)} /></label><span /><label className="text-sm sm:col-span-2">Número del certificado energético<input disabled={!editing} className={inputClass} value={form.energy_certificate_number} onChange={e => change('energy_certificate_number', e.target.value)} /></label><label className="text-sm">Calificación energética<select disabled={!editing} className={inputClass} value={form.energy_rating} onChange={e => change('energy_rating', e.target.value)}><option value="">Sin indicar</option>{['A','B','C','D','E','F','G'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Caducidad certificado energético<input disabled={!editing} type="date" className={inputClass} value={form.energy_certificate_expiry || ''} onChange={e => change('energy_certificate_expiry', e.target.value)} /></label><label className="text-sm">Contacto de la comunidad<input disabled={!editing} className={inputClass} value={form.community_contact} onChange={e => change('community_contact', e.target.value)} /></label><label className="text-sm">Póliza del seguro<input disabled={!editing} className={inputClass} value={form.insurance_policy} onChange={e => change('insurance_policy', e.target.value)} /></label></div></Section>

    <Section icon={Building2} title="Observaciones" description="Cualquier dato de la finca o la vivienda que convenga conservar."><textarea disabled={!editing} rows={5} className={inputClass} value={form.notes} onChange={e => change('notes', e.target.value)} placeholder="ITE, administrador, limitaciones de la comunidad, instalaciones antiguas…" /></Section>
    {editing && <div className="sticky bottom-[5.25rem] z-10 rounded-2xl bg-stone-900/95 p-3 shadow-xl backdrop-blur lg:bottom-4"><Button type="submit" className="w-full" disabled={saving}><Save size={16} />{saving ? 'Guardando…' : 'Guardar información de la vivienda'}</Button></div>}
    </form>
    <HomeDocuments canEdit={role !== 'viewer'} />
  </div>
}
