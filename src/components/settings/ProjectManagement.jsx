import { useEffect, useState } from 'react'
import { Archive, Building2, Copy, LoaderCircle, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import {
  archiveProject, deleteProject, duplicateProject, getProjectDetails, getUserProjects,
  restoreProject, updateProjectDetails,
} from '../../services/workspaceService'

const emptyProject = {
  name: '', description: '', address: '', status: 'planning', start_date: '',
  target_end_date: '', estimated_budget: '',
}

const statusLabels = { planning: 'Planificación', in_progress: 'En obras', completed: 'Finalizada', archived: 'Archivada' }

export default function ProjectManagement() {
  const [project, setProject] = useState(emptyProject)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const [details, list] = await Promise.all([getProjectDetails(), getUserProjects()])
      setProject({ ...emptyProject, ...details, start_date: details?.start_date || '', target_end_date: details?.target_end_date || '', estimated_budget: details?.estimated_budget ?? '' })
      setProjects(list)
    } catch (err) { setError(err.message || 'No se pudo cargar la reforma.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault(); setBusy('save'); setError(''); setNotice('')
    try { await updateProjectDetails(project); setNotice('Datos de la reforma guardados.'); await load() }
    catch (err) { setError(err.message || 'No se pudieron guardar los cambios.') }
    finally { setBusy('') }
  }

  async function duplicate(event) {
    event.preventDefault(); setBusy('duplicate'); setError('')
    try { await duplicateProject(project.project_id, duplicateName); window.location.reload() }
    catch (err) { setError(err.message || 'No se pudo duplicar la reforma.'); setBusy('') }
  }

  async function executeConfirmation() {
    if (!confirmation) return
    setBusy(confirmation.type); setError('')
    try {
      if (confirmation.type === 'archive') await archiveProject(project.project_id)
      if (confirmation.type === 'delete') await deleteProject(project.project_id)
      window.location.reload()
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.')
      setConfirmation(null); setBusy('')
    }
  }

  async function restore(item) {
    setBusy(item.project_id); setError(''); setNotice('')
    try { await restoreProject(item.project_id); setNotice(`“${item.name}” vuelve a estar activa.`); await load() }
    catch (err) { setError(err.message || 'No se pudo restaurar la reforma.') }
    finally { setBusy('') }
  }

  const canEdit = project.role === 'owner' || project.role === 'editor'
  const activeAlternatives = projects.filter(item => !item.archived_at && item.project_id !== project.project_id)
  const archived = projects.filter(item => item.archived_at)

  return <section className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-terracotta-light p-2.5 text-terracotta"><Building2 size={20} /></span><div><h2 className="text-lg font-semibold text-stone-700">Datos de la reforma</h2><p className="mt-1 text-sm text-stone-500">La ficha principal y el ciclo de vida de este proyecto.</p></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-olive-light p-3 text-sm text-olive">{notice}</p>}
    {loading ? <div className="grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-stone-400" /></div> : <>
      <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre" value={project.name} onChange={event => setProject({ ...project, name: event.target.value })} maxLength={80} required disabled={!canEdit} />
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">Estado</span><select value={project.status} onChange={event => setProject({ ...project, status: event.target.value })} disabled={!canEdit} className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-olive focus:ring-2 focus:ring-olive/15 disabled:bg-stone-50">{Object.entries(statusLabels).filter(([key]) => key !== 'archived').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div className="sm:col-span-2"><Input label="Dirección" value={project.address} onChange={event => setProject({ ...project, address: event.target.value })} placeholder="Calle, número, localidad" maxLength={300} disabled={!canEdit} /></div>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-stone-700">Descripción breve</span><textarea value={project.description} onChange={event => setProject({ ...project, description: event.target.value })} maxLength={1000} rows={3} disabled={!canEdit} placeholder="Objetivo de la reforma, alcance o notas generales" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-olive focus:ring-2 focus:ring-olive/15 disabled:bg-stone-50" /></label>
          <Input label="Fecha de inicio" type="date" value={project.start_date} onChange={event => setProject({ ...project, start_date: event.target.value })} disabled={!canEdit} />
          <Input label="Fecha objetivo" type="date" value={project.target_end_date} onChange={event => setProject({ ...project, target_end_date: event.target.value })} disabled={!canEdit} />
          <Input label="Presupuesto estimado (€)" type="number" min="0" step="0.01" value={project.estimated_budget} onChange={event => setProject({ ...project, estimated_budget: event.target.value })} disabled={!canEdit} />
        </div>
        {canEdit && <div className="flex justify-end"><Button type="submit" disabled={busy === 'save' || !project.name.trim()}><Save size={16} />{busy === 'save' ? 'Guardando…' : 'Guardar cambios'}</Button></div>}
      </form>

      {project.role === 'owner' && <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <h3 className="text-sm font-semibold text-stone-700">Organizar reformas</h3><p className="mt-1 text-xs leading-relaxed text-stone-500">Duplica esta estructura para otra obra, archívala al terminar o elimínala definitivamente.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => { setDuplicateName(`${project.name} — copia`); setDuplicateOpen(true) }}><Copy size={16} /> Duplicar como plantilla</Button>
          <Button type="button" variant="ghost" disabled={!activeAlternatives.length || Boolean(busy)} onClick={() => setConfirmation({ type: 'archive', title: 'Archivar reforma', message: `¿Archivar “${project.name}”? Podrás restaurarla después desde este apartado.` })}><Archive size={16} /> Archivar</Button>
          <Button type="button" variant="danger" disabled={!activeAlternatives.length || Boolean(busy)} onClick={() => setConfirmation({ type: 'delete', title: 'Eliminar definitivamente', message: `Se eliminarán “${project.name}”, todos sus datos y sus archivos. Esta acción no se puede deshacer.` })}><Trash2 size={16} /> Eliminar</Button>
        </div>
        {!activeAlternatives.length && <p className="mt-3 text-xs text-stone-400">Crea otra reforma antes de archivar o eliminar la actual.</p>}
      </div>}

      {archived.length > 0 && <div className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Reformas archivadas</h3>{archived.map(item => <div key={item.project_id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"><div className="min-w-0"><p className="truncate text-sm font-medium text-stone-700">{item.name}</p><p className="text-xs text-stone-400">Archivada {new Date(item.archived_at).toLocaleDateString('es-ES')}</p></div>{item.role === 'owner' && <Button type="button" size="sm" variant="ghost" disabled={busy === item.project_id} onClick={() => restore(item)}><RotateCcw size={15} /> Restaurar</Button>}</div>)}</div>}
    </>}

    <Modal open={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Duplicar reforma">
      <form onSubmit={duplicate} className="space-y-4"><p className="text-sm leading-relaxed text-stone-500">Se copiarán los datos generales, categorías y estancias. La nueva reforma empezará sin presupuestos, tareas ni documentos.</p><Input label="Nombre de la nueva reforma" value={duplicateName} onChange={event => setDuplicateName(event.target.value)} maxLength={80} autoFocus required /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDuplicateOpen(false)}>Cancelar</Button><Button type="submit" disabled={!duplicateName.trim() || busy === 'duplicate'}>{busy === 'duplicate' ? 'Duplicando…' : 'Crear copia'}</Button></div></form>
    </Modal>
    <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.title || ''} message={confirmation?.message || ''} onConfirm={executeConfirmation} onCancel={() => setConfirmation(null)} />
  </section>
}
