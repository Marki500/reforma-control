import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Upload, Loader2, X, PencilRuler, ArrowUpRight, Image, Square } from 'lucide-react'
import { getFloorPlans, createFloorPlan, deleteFloorPlan, uploadFile } from '../services/floorplanService'
import { getRooms } from '../services/materialsService'
import { getWorkspaceContext } from '../services/workspaceService'
import { supabase } from '../services/supabaseClient'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import FloorPlanEditor from '../components/floorplan/FloorPlanEditor'
import PlanDrawing from '../components/floorplan/PlanDrawing'
import { emptyPlan, examplePlan, planBounds, validatePlan } from '../utils/floorPlan'
import { removeStoredFile } from '../services/storageCleanup'

function PlanPreview({ data }) {
  const bounds = planBounds(data)
  return <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} className="h-full w-full" aria-hidden="true"><PlanDrawing plan={data} dimensions={false} /></svg>
}

export default function FloorPlan() {
  const [error, setError] = useState(''), [plans, setPlans] = useState([]), [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true), [uploading, setUploading] = useState(false), [deleting, setDeleting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false), [viewImage, setViewImage] = useState(null), [confirmDelete, setConfirmDelete] = useState(null)
  const [editor, setEditor] = useState(null), [context, setContext] = useState(null), [userId, setUserId] = useState('')
  const [sample] = useState(examplePlan)
  const fileRef = useRef(null)
  const canEdit = ['owner', 'editor'].includes(context?.role)
  async function loadPlans() {
    setLoading(true); setError('')
    try {
      const [data, roomList, workspace, session] = await Promise.all([getFloorPlans(), getRooms(), getWorkspaceContext(), supabase.auth.getSession()])
      setPlans(data); setRooms(roomList); setContext(workspace); setUserId(session.data.session?.user?.id || '')
    } catch (err) { setError(err.message || 'No se pudieron cargar los planos.') }
    finally { setLoading(false) }
  }
  useEffect(() => { loadPlans() }, [])
  function createInteractive(withExample = false) {
    setEditor({ id: crypto.randomUUID(), name: withExample ? 'Distribución de prueba' : 'Mi plano', plan_data: withExample ? examplePlan() : emptyPlan(), draftSlot: 'new' })
  }
  function openPlan(plan) {
    if (plan.plan_data) {
      if (!validatePlan(plan.plan_data)) { setError('Este plano contiene datos que el editor no puede abrir.'); return }
      setEditor(plan)
    } else setViewImage(plan)
  }
  async function handleUpload(file) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Selecciona una imagen PNG, JPG o WebP de hasta 5 MB.'); return }
    setError(''); setUploading(true)
    let result
    try {
      result = await uploadFile(file)
      await createFloorPlan({ name: file.name.replace(/\.[^/.]+$/, ''), image_url: result.url })
      await loadPlans(); setModalOpen(false)
    } catch (err) {
      if (result?.url) await removeStoredFile('images', result.url).catch(() => {})
      setError(err.message || 'No se pudo subir el plano.')
    } finally { setUploading(false) }
  }
  async function confirmDeletePlan() {
    if (!confirmDelete || deleting) return
    setDeleting(true)
    try { await deleteFloorPlan(confirmDelete); setConfirmDelete(null); await loadPlans() }
    catch (err) { setError(err.message || 'No se pudo eliminar el plano.') }
    finally { setDeleting(false) }
  }
  return <div className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-stone-800">Planos</h1><p className="mt-1 text-sm text-stone-500">Dibuja tu distribución y guarda los planos de tu reforma.</p></div>{canEdit && <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setModalOpen(true)}><Upload size={16} />Subir imagen</Button><Button onClick={() => createInteractive()}><Plus size={17} />Crear plano 2D</Button></div>}</div>
    {error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><span>{error}</span><button onClick={() => setError('')} aria-label="Cerrar aviso"><X size={17} /></button></div>}
    {loading ? <div role="status" className="py-20 text-center text-sm text-stone-500"><Loader2 size={25} className="mx-auto mb-3 animate-spin" />Cargando planos…</div> : <>
      {canEdit && <section className="mb-8 grid overflow-hidden rounded-2xl bg-stone-800 text-white md:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col items-start justify-center p-6 sm:p-8"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-300">Tu casa, sobre el papel</span><h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight">Prueba una nueva distribución.</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-300">Traza paredes, define habitaciones y coloca puertas y ventanas. Todo en metros, con espacio para cambiar de idea.</p><Button className="mt-5 !bg-white !text-stone-800 hover:!bg-stone-100" onClick={() => createInteractive(true)}><PencilRuler size={17} />Probar con un ejemplo<ArrowUpRight size={16} /></Button></div>
        <div className="relative min-h-56 bg-[#eae9df] px-6 py-2"><PlanPreview data={sample} /><span className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wider text-stone-500">Ejemplo editable · 24 m²</span></div>
      </section>}
      <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-stone-700">Tus planos</h2><span className="text-xs text-stone-500">{plans.length} {plans.length === 1 ? 'plano' : 'planos'}</span></div>
      {!plans.length ? <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center"><Square size={28} className="mx-auto mb-3 text-olive" /><h3 className="font-semibold text-stone-700">Aquí empieza tu distribución</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-500">{canEdit ? 'Crea un plano en blanco o abre el ejemplo para explorar el editor. También puedes conservar tus planos como imágenes.' : 'Los planos del proyecto aparecerán aquí cuando se añadan.'}</p>{error && <Button className="mt-4" variant="secondary" onClick={loadPlans}>Reintentar carga</Button>}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{plans.map(plan => <article key={plan.id} className="group overflow-hidden rounded-2xl bg-white">
        <button onClick={() => openPlan(plan)} className="block w-full text-left"><div className="aspect-[16/10] overflow-hidden bg-[#faf9f5] p-3">{plan.plan_data && validatePlan(plan.plan_data) ? <PlanPreview data={plan.plan_data} /> : plan.image_url ? <img src={plan.image_url} alt={plan.name} className="h-full w-full rounded-lg object-contain" /> : <Image size={30} className="mx-auto mt-12 text-stone-300" />}</div><div className="px-4 pt-4"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-olive">{plan.plan_data ? 'Plano interactivo · 2D' : 'Plano adjunto · Imagen'}</p><h3 className="truncate font-semibold text-stone-800">{plan.name}</h3></div></button>
        <div className="flex items-center justify-between px-4 pb-3 pt-2"><p className="text-xs text-stone-500">{new Date(plan.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>{canEdit && <button onClick={() => setConfirmDelete(plan)} aria-label={`Eliminar plano ${plan.name}`} className="rounded-lg p-3 text-stone-400 hover:bg-red-50 hover:text-terracotta"><Trash2 size={16} /></button>}</div>
      </article>)}</div>}
    </>}
    <Modal open={modalOpen} onClose={() => !uploading && setModalOpen(false)} title="Subir plano como imagen"><button disabled={uploading} className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-10 hover:border-olive" onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 size={30} className="animate-spin text-olive" /> : <><Upload size={30} className="text-olive" /><span className="text-sm text-stone-600">Seleccionar imagen del plano</span><span className="text-xs text-stone-400">PNG, JPG, WEBP · Hasta 5 MB</span></>}</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { handleUpload(event.target.files?.[0]); event.target.value = '' }} disabled={uploading} /></Modal>
    {viewImage && <Modal open onClose={() => setViewImage(null)} title={viewImage.name} wide><img src={viewImage.image_url} alt={viewImage.name} className="max-h-[75dvh] w-full object-contain" /></Modal>}
    <ConfirmDialog open={!!confirmDelete} title="Eliminar plano" message={`¿Eliminar «${confirmDelete?.name}»?`} busy={deleting} onConfirm={confirmDeletePlan} onCancel={() => setConfirmDelete(null)} />
    {editor && <FloorPlanEditor key={editor.id} plan={editor} rooms={rooms} canEdit={canEdit} draftKey={`nivel:floorplan:${userId}:${context.project_id}:${editor.draftSlot || editor.id}`} onClose={() => setEditor(null)} onSaved={saved => setPlans(previous => [saved, ...previous.filter(item => item.id !== saved.id)])} />}
  </div>
}
