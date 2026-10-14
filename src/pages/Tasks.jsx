import { useEffect, useState } from 'react'
import { CheckSquare, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react'
import { deleteTask, getTasks, saveTask, setTaskCompleted, setTaskItemCompleted } from '../services/tasksService'
import { getRooms } from '../services/materialsService'
import { filterTasks, getTaskProgress, isTaskOverdue } from '../utils/tasks'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const statuses = ['Pendiente', 'En curso', 'Completada']
const priorities = ['Baja', 'Media', 'Alta', 'Urgente']
const empty = { title: '', description: '', status: 'Pendiente', priority: 'Media', due_date: '', room_id: '', task_items: [] }
const fieldClass = 'min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', room_id: '', overdue: false })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [busyItem, setBusyItem] = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const [items, roomList] = await Promise.all([getTasks(), getRooms()])
      setTasks(items); setRooms(roomList)
    } catch (err) { setError(err.message || 'No se pudieron cargar las tareas.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const filtered = filterTasks(tasks, filters)
  const changeFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  function edit(task) {
    setEditing(task?.id || null)
    setForm(task ? {
      ...empty,
      ...task,
      due_date: task.due_date || '',
      room_id: task.room_id || '',
      task_items: (task.task_items || []).map(item => ({ ...item })),
    } : { ...empty, task_items: [] })
    setFormError(''); setOpen(true)
  }
  function addStep() {
    setForm(prev => ({ ...prev, task_items: [...prev.task_items, { title: '', is_completed: false }] }))
  }
  function changeStep(index, key, value) {
    setForm(prev => ({ ...prev, task_items: prev.task_items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  }
  function removeStep(index) {
    setForm(prev => ({ ...prev, task_items: prev.task_items.filter((_, itemIndex) => itemIndex !== index) }))
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (!form.title.trim()) { setFormError('Escribe un título.'); return }
    if (form.task_items.some(item => !item.title.trim())) { setFormError('Escribe el texto de cada paso o elimina las filas vacías.'); return }
    setBusy(true); setFormError('')
    try {
      const saved = await saveTask(editing, form)
      setTasks(prev => editing ? prev.map(task => task.id === saved.id ? saved : task) : [saved, ...prev])
      setOpen(false)
    } catch (err) { setFormError(err.message || 'No se pudo guardar la tarea.') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (busy || !deleting) return
    setBusy(true); setError('')
    try { await deleteTask(deleting.id); setTasks(prev => prev.filter(task => task.id !== deleting.id)); setDeleting(null) }
    catch (err) { setError(err.message || 'No se pudo eliminar la tarea.'); setDeleting(null) }
    finally { setBusy(false) }
  }
  async function toggle(task) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const saved = await setTaskCompleted(task, task.status !== 'Completada')
      setTasks(prev => prev.map(item => item.id === saved.id ? saved : item))
    } catch (err) { setError(err.message || 'No se pudo actualizar la tarea.') }
    finally { setBusy(false) }
  }
  async function toggleStep(task, item) {
    if (busyItem) return
    setBusyItem(item.id); setError('')
    try {
      const saved = await setTaskItemCompleted(task, item, !item.is_completed)
      setTasks(prev => prev.map(current => current.id === saved.id ? saved : current))
    } catch (err) { setError(err.message || 'No se pudo actualizar el paso.') }
    finally { setBusyItem(null) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-stone-800">Tareas</h1><p className="mt-1 text-sm text-stone-500">{tasks.filter(task => task.status !== 'Completada').length} abiertas · {tasks.filter(task => isTaskOverdue(task)).length} vencidas</p></div>
        <Button onClick={() => edit(null)} disabled={loading || Boolean(error)}><Plus size={16} /> Añadir tarea</Button>
      </div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={load} className="underline">Reintentar</button></div>}
      <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2">
        <input aria-label="Buscar tareas" placeholder="Buscar tareas o pasos…" className={fieldClass} value={filters.search} onChange={e => changeFilter('search', e.target.value)} />
        <select aria-label="Filtrar por estado" className={fieldClass} value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">Todos los estados</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por prioridad" className={fieldClass} value={filters.priority} onChange={e => changeFilter('priority', e.target.value)}><option value="">Todas las prioridades</option>{priorities.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por estancia" className={fieldClass} value={filters.room_id} onChange={e => changeFilter('room_id', e.target.value)}><option value="">Todas las estancias</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={filters.overdue} onChange={e => changeFilter('overdue', e.target.checked)} /> Solo vencidas</label>
      </div>
      {loading ? <p role="status">Cargando tareas…</p> : !error && filtered.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center text-stone-500"><CheckSquare className="mx-auto mb-3" />{tasks.length ? 'No hay tareas con estos filtros.' : 'Añade tu primera tarea de la reforma.'}</div> : filtered.map(task => {
        const progress = getTaskProgress(task)
        return (
          <article key={task.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
            <div className="flex items-start gap-3 p-5">
              <input className="mt-1 h-5 w-5 accent-stone-700" type="checkbox" aria-label={`Completar ${task.title}`} checked={task.status === 'Completada'} disabled={busy} onChange={() => toggle(task)} />
              <div className="min-w-0 flex-1"><h2 className={`break-words font-semibold ${task.status === 'Completada' ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{task.title}</h2>{task.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-500">{task.description}</p>}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600"><span>{task.status}</span><span>Prioridad {task.priority.toLowerCase()}</span>{task.rooms?.name && <span>{task.rooms.name}</span>}{task.due_date && <span className={isTaskOverdue(task) ? 'font-semibold text-red-600' : ''}>{isTaskOverdue(task) ? 'Vencida · ' : ''}{new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-ES')}</span>}</div>
              </div>
              <button aria-label={`Editar ${task.title}`} className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400" disabled={busy} onClick={() => edit(task)}><Pencil size={18} /></button>
              <button aria-label={`Eliminar ${task.title}`} className="rounded-lg p-2 text-stone-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400" disabled={busy} onClick={() => setDeleting(task)}><Trash2 size={18} /></button>
            </div>
            {progress.total > 0 && <div className="border-t border-stone-100 bg-stone-50/70 px-5 py-4 sm:pl-12">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs font-medium text-stone-600"><span className="flex items-center gap-2"><ListChecks size={15} /> Pasos</span><span className="tabular-nums">{progress.completed} de {progress.total}</span></div>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-olive transition-[width] duration-300" style={{ width: `${progress.percent}%` }} /></div>
              <ul className="space-y-2">
                {task.task_items.map(item => <li key={item.id} className="flex items-start gap-2.5 text-sm text-stone-700">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-stone-700" aria-label={`Completar paso ${item.title}`} checked={item.is_completed} disabled={Boolean(busyItem)} onChange={() => toggleStep(task, item)} />
                  <span className={`break-words ${item.is_completed ? 'text-stone-400 line-through' : ''}`}>{item.title}</span>
                </li>)}
              </ul>
            </div>}
          </article>
        )
      })}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? 'Editar tarea' : 'Nueva tarea'}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <label className="block text-sm">Título<input className={fieldClass} value={form.title} required maxLength={200} onChange={e => change('title', e.target.value)} /></label>
          <label className="block text-sm">Descripción<textarea className={fieldClass} rows={3} value={form.description} onChange={e => change('description', e.target.value)} /></label>
          <fieldset className="rounded-xl bg-stone-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3"><div><legend className="text-sm font-medium text-stone-800">Pasos de la tarea</legend><p className="text-xs text-stone-500">Una lista breve de todo lo que hay que resolver.</p></div><button type="button" onClick={addStep} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"><Plus size={16} /> Añadir</button></div>
            {form.task_items.length === 0 ? <button type="button" onClick={addStep} className="w-full rounded-lg border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500 transition hover:border-stone-500 hover:text-stone-700">Añade pasos como “Aceptar presupuesto” o “Pedir certificado”</button> : <div className="space-y-2">{form.task_items.map((item, index) => <div key={item.id || `new-${index}`} className="flex items-center gap-2">
              <input type="checkbox" aria-label={`Marcar paso ${index + 1} como completado`} className="h-4 w-4 shrink-0 accent-stone-700" checked={item.is_completed} onChange={e => changeStep(index, 'is_completed', e.target.checked)} />
              <input aria-label={`Paso ${index + 1}`} autoFocus={!item.id && index === form.task_items.length - 1} className={fieldClass} placeholder="Escribe un paso…" maxLength={200} value={item.title} onChange={e => changeStep(index, 'title', e.target.value)} />
              <button type="button" aria-label={`Eliminar paso ${index + 1}`} onClick={() => removeStep(index)} className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><X size={18} /></button>
            </div>)}</div>}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Estado<select className={fieldClass} value={form.status} onChange={e => change('status', e.target.value)}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="block text-sm">Prioridad<select className={fieldClass} value={form.priority} onChange={e => change('priority', e.target.value)}>{priorities.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="block text-sm">Fecha límite<input type="date" className={fieldClass} value={form.due_date} onChange={e => change('due_date', e.target.value)} /></label>
            <label className="block text-sm">Estancia<select className={fieldClass} value={form.room_id} onChange={e => change('room_id', e.target.value)}><option value="">Sin estancia</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar tarea'}</Button></div>
        </form>
      </Modal>
      <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)} title="Eliminar tarea">
        <p className="mb-4 text-sm">¿Eliminar «{deleting?.title}»? También se eliminarán sus pasos. Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2"><Button disabled={busy} variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button><Button disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Eliminar'}</Button></div>
      </Modal>
    </div>
  )
}
