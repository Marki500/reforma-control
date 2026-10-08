import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckSquare, Receipt, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getTasks } from '../../services/tasksService'
import { getExpenses } from '../../services/expensesService'
import { buildNotifications } from '../../utils/notifications'
import { localDateKey } from '../../utils/tasks'
import { formatCurrency } from '../../utils/formatCurrency'

const storageKey = 'reforma-dismissed-notifications'

function readDismissed() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
}

export default function NotificationsMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(readDismissed)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [tasks, expenses] = await Promise.all([getTasks(), getExpenses()])
      setItems(buildNotifications(tasks, expenses, localDateKey()))
    } catch { setError('No se pudieron cargar los avisos.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const visible = useMemo(() => items.filter(item => !dismissed.includes(item.id)), [items, dismissed])

  function dismiss(event, id) {
    event.stopPropagation()
    const next = [...new Set([...dismissed, id])].slice(-200)
    setDismissed(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function go(item) {
    setOpen(false); navigate(item.route)
  }

  return <div className="relative">
    <button type="button" aria-label={`Notificaciones${visible.length ? `: ${visible.length}` : ''}`} aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) load() }} className="relative rounded-xl p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700">
      <Bell size={19} />
      {visible.length > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{visible.length > 99 ? '99+' : visible.length}</span>}
    </button>
    {open && <><button type="button" aria-label="Cerrar notificaciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} /><div className="fixed left-3 right-3 top-16 z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><div><h2 className="font-semibold text-stone-800">Notificaciones</h2><p className="text-xs text-stone-500">Vencidas y próximos 7 días</p></div>{visible.length > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{visible.length}</span>}</div>
      <div className="max-h-[60vh] overflow-y-auto p-2">{loading ? <p role="status" className="p-6 text-center text-sm text-stone-500">Cargando…</p> : error ? <div className="p-5 text-center text-sm text-red-700">{error}<button onClick={load} className="mt-2 block w-full underline">Reintentar</button></div> : visible.length === 0 ? <div className="p-8 text-center text-stone-500"><Bell className="mx-auto mb-2 text-stone-300" /><p className="text-sm">Todo al día.</p></div> : visible.map(item => <div key={item.id} className="mb-1 flex items-start rounded-xl hover:bg-stone-50">
        <button type="button" onClick={() => go(item)} className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left"><span className={`mt-0.5 rounded-lg p-2 ${item.level === 'overdue' ? 'bg-red-50 text-red-600' : item.level === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>{item.type === 'task' ? <CheckSquare size={16} /> : <Receipt size={16} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-stone-800">{item.title}</span><span className={`mt-0.5 block text-xs ${item.level === 'overdue' ? 'font-medium text-red-600' : 'text-stone-500'}`}>{item.label} · {new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES')}{item.type === 'payment' ? ` · ${formatCurrency(item.amount)}` : ''}</span></span></button>
        <button type="button" aria-label={`Descartar ${item.title}`} onClick={event => dismiss(event, item.id)} className="m-2 rounded-lg p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-600"><X size={15} /></button>
      </div>)}</div>
    </div></>}
  </div>
}
