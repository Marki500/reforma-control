import { useEffect, useState } from 'react'
import { Activity, LoaderCircle } from 'lucide-react'
import { getProjectActivity } from '../../services/workspaceService'

export default function ProjectActivity() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { getProjectActivity(40).then(setItems).catch(err => setError(err.message || 'No se pudo cargar la actividad.')).finally(() => setLoading(false)) }, [])

  return <section className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-stone-200 p-2.5 text-stone-600"><Activity size={20} /></span><div><h2 className="text-lg font-semibold text-stone-700">Actividad reciente</h2><p className="mt-1 text-sm text-stone-500">Quién ha cambiado qué dentro de esta reforma.</p></div></div>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
      {loading ? <div className="grid min-h-28 place-items-center"><LoaderCircle className="animate-spin text-stone-400" /></div> : items.length === 0 ? <p className="p-5 text-sm text-stone-400">La actividad aparecerá aquí cuando alguien edite tareas, presupuestos, gastos o proveedores.</p> : <div className="divide-y divide-stone-100">{items.map(item => <div key={item.id} className="flex gap-3 px-4 py-3.5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" /><div className="min-w-0 flex-1"><p className="text-sm text-stone-700">{item.summary}</p><p className="mt-1 truncate text-xs text-stone-400">{item.actor_email} · {new Date(item.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>)}</div>}
    </div>
  </section>
}
