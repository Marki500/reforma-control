import { useEffect, useState } from 'react'
import { ArrowRight, Building2 } from 'lucide-react'
import { getProjectDetails, updateProjectDetails } from '../../services/workspaceService'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

export default function ProjectOnboarding() {
  const [project, setProject] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getProjectDetails().then(details => { if (details && !details.setup_completed && details.role !== 'viewer') setProject({ ...details, address: details.address || '', start_date: details.start_date || '', target_end_date: details.target_end_date || '', estimated_budget: details.estimated_budget ?? '' }) }).catch(() => {}) }, [])

  async function finish(event) {
    event?.preventDefault(); setSaving(true); setError('')
    try { await updateProjectDetails(project); setProject(null) }
    catch (err) { setError(err.message || 'No se pudo completar la configuración.'); setSaving(false) }
  }

  if (!project) return null
  return <Modal open onClose={() => {}} title="Prepara tu nueva reforma">
    <form onSubmit={finish} className="space-y-5">
      <div className="flex gap-3 rounded-2xl bg-olive-light p-4"><Building2 className="shrink-0 text-olive" size={22} /><p className="text-sm leading-relaxed text-stone-600">Estos datos harán que el panel sea útil desde el primer momento. Después podrás cambiarlos en Ajustes.</p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Input label="Nombre de la reforma" value={project.name} onChange={event => setProject({ ...project, name: event.target.value })} required maxLength={80} autoFocus />
      <Input label="Dirección (opcional)" value={project.address} onChange={event => setProject({ ...project, address: event.target.value })} placeholder="Calle, número, localidad" />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Inicio previsto" type="date" value={project.start_date} onChange={event => setProject({ ...project, start_date: event.target.value })} /><Input label="Final previsto" type="date" value={project.target_end_date} onChange={event => setProject({ ...project, target_end_date: event.target.value })} /></div>
      <Input label="Presupuesto estimado (€)" type="number" min="0" step="0.01" value={project.estimated_budget} onChange={event => setProject({ ...project, estimated_budget: event.target.value })} />
      <Button type="submit" className="w-full" disabled={saving || !project.name.trim()}>{saving ? 'Preparando…' : <>Entrar en la reforma <ArrowRight size={16} /></>}</Button>
    </form>
  </Modal>
}
