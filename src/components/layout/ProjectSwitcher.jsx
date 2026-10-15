import { useEffect, useState } from 'react'
import { Building2, Check, ChevronDown, LoaderCircle, Pencil, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  createProject,
  getUserProjects,
  getWorkspaceContext,
  switchProject,
  updateProject,
} from '../../services/workspaceService'

const roleLabels = { owner: 'Propietario', editor: 'Puede editar', viewer: 'Solo lectura' }

export default function ProjectSwitcher({ compact = false, inverse = false, accountLabel = '' }) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [mode, setMode] = useState('list')
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [items, context] = await Promise.all([getUserProjects(), getWorkspaceContext()])
      setProjects(items)
      setCurrent(context)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las reformas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function close() {
    setOpen(false)
    setMode('list')
    setEditing(null)
    setName('')
    setError('')
  }

  async function selectProject(project) {
    if (project.is_active) {
      close()
      return
    }
    setWorkingId(project.project_id)
    setError('')
    try {
      await switchProject(project.project_id)
      window.location.reload()
    } catch (err) {
      setError(err.message || 'No se pudo abrir la reforma.')
      setWorkingId('')
    }
  }

  function startCreate() {
    setEditing(null)
    setName('')
    setMode('form')
    setError('')
  }

  function startEdit(project) {
    setEditing(project)
    setName(project.name)
    setMode('form')
    setError('')
  }

  async function saveProject(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setWorkingId(editing?.project_id || 'new')
    setError('')
    try {
      if (editing) {
        await updateProject(editing.project_id, cleanName)
        await load()
        setMode('list')
        setEditing(null)
        setName('')
      } else {
        await createProject(cleanName)
        window.location.reload()
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar la reforma.')
    } finally {
      setWorkingId('')
    }
  }

  const triggerColors = inverse
    ? 'bg-white/[0.07] text-white hover:bg-white/[0.11] focus-visible:ring-white/40'
    : 'bg-white text-stone-800 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 focus-visible:ring-terracotta'
  const activeProjects = projects.filter(project => !project.archived_at)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex min-w-0 items-center text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${compact ? `max-w-[9.5rem] gap-2 rounded-xl px-2 py-2 sm:max-w-[12rem] sm:px-2.5 ${triggerColors}` : `w-full gap-3 rounded-2xl px-3.5 py-3 ${triggerColors}`}`}
        aria-label="Seleccionar reforma"
      >
        <span className={`grid shrink-0 place-items-center rounded-xl ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${inverse ? 'bg-terracotta text-white' : 'bg-terracotta-light text-terracotta'}`}>
          <Building2 size={compact ? 17 : 20} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          {!compact && <span className={`block text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${inverse ? 'text-white/35' : 'text-stone-400'}`}>Reforma activa</span>}
          <span className={`block truncate font-semibold ${compact ? 'text-sm' : 'mt-0.5 text-[0.94rem]'}`}>
            {loading ? 'Cargando…' : current?.project_name || 'Mi reforma'}
          </span>
          {compact && accountLabel && <span className="mt-0.5 block truncate text-[0.66rem] font-medium text-stone-500">{accountLabel}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform group-hover:translate-y-0.5 ${inverse ? 'text-white/40' : 'text-stone-400'}`} />
      </button>

      <Modal open={open} onClose={close} title={mode === 'form' ? (editing ? 'Cambiar nombre' : 'Nueva reforma') : 'Tus reformas'}>
        {mode === 'list' ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-stone-500">Elige la reforma en la que quieres trabajar. Cada una conserva sus propios presupuestos, tareas y documentos.</p>
            {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {loading ? (
              <div className="grid min-h-36 place-items-center text-stone-400"><LoaderCircle className="animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((project) => (
                  <div key={project.project_id} className={`group flex items-center gap-2 rounded-2xl p-2 transition ${project.is_active ? 'bg-olive-light ring-1 ring-olive/20' : 'bg-stone-50 hover:bg-stone-100'}`}>
                    <button type="button" onClick={() => selectProject(project)} disabled={Boolean(workingId)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${project.is_active ? 'bg-olive text-white' : 'bg-white text-stone-500 shadow-sm'}`}>
                        {workingId === project.project_id ? <LoaderCircle size={19} className="animate-spin" /> : project.is_active ? <Check size={19} /> : <Building2 size={19} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-800">{project.name}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{project.is_active ? 'Abierta ahora' : roleLabels[project.role] || project.role}</span>
                      </span>
                    </button>
                    {project.role === 'owner' && (
                      <button type="button" onClick={() => startEdit(project)} className="rounded-xl p-3 text-stone-400 hover:bg-white hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400" aria-label={`Editar ${project.name}`}>
                        <Pencil size={17} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="secondary" className="w-full" onClick={startCreate} disabled={loading || Boolean(workingId)}>
              <Plus size={17} /> Crear otra reforma
            </Button>
          </div>
        ) : (
          <form onSubmit={saveProject} className="space-y-5">
            <p className="text-sm leading-relaxed text-stone-500">{editing ? 'Usa un nombre fácil de reconocer, por ejemplo la dirección o el tipo de obra.' : 'Empezarás con una reforma vacía y podrás volver a las anteriores cuando quieras.'}</p>
            {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <Input label="Nombre de la reforma" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Casa de Badalona" maxLength={80} autoFocus required />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => { setMode('list'); setError('') }}>Volver</Button>
              <Button type="submit" disabled={!name.trim() || Boolean(workingId)}>
                {workingId ? <LoaderCircle size={16} className="animate-spin" /> : editing ? <Pencil size={16} /> : <Plus size={16} />}
                {workingId ? 'Guardando…' : editing ? 'Guardar nombre' : 'Crear y abrir'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
