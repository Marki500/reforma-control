import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getTasks } from '../services/tasksService'
import { getExpenses } from '../services/expensesService'
import { calendarEvents, monthDays } from '../utils/calendar'
import { localDateKey } from '../utils/tasks'
import { formatCurrency } from '../utils/formatCurrency'
import { Button } from '../components/ui/Button'

const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function Calendar() {
  const navigate = useNavigate()
  const today = localDateKey()
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
  const [tasks, setTasks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [taskList, expenseList] = await Promise.all([getTasks(), getExpenses()])
      setTasks(taskList); setExpenses(expenseList)
    } catch (err) { setError(err.message || 'No se pudo cargar el calendario.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const days = useMemo(() => monthDays(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const events = useMemo(() => calendarEvents(tasks, expenses), [tasks, expenses])
  const byDate = useMemo(() => events.reduce((map, event) => { (map[event.date] ||= []).push(event); return map }, {}), [events])
  const monthEvents = events.filter(event => event.date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`))
  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const move = offset => setCursor(previous => new Date(previous.getFullYear(), previous.getMonth() + offset, 1, 12))
  const openEvent = event => navigate(event.type === 'task' ? '/tareas' : '/gastos')

  function Event({ event, compact = false }) {
    const overdue = event.date < today && !event.completed
    return <button type="button" onClick={() => openEvent(event)} className={`flex w-full items-center gap-2 rounded-lg text-left text-xs ${compact ? 'px-2 py-1.5' : 'p-3'} ${event.completed ? 'bg-green-50 text-green-700' : overdue ? 'bg-red-50 text-red-700' : event.type === 'payment' ? 'bg-gold-light text-stone-700' : 'bg-olive-light text-stone-700'}`}>
      {event.type === 'payment' ? <Receipt size={13} className="shrink-0" /> : <CheckSquare size={13} className="shrink-0" />}
      <span className={`min-w-0 flex-1 truncate ${event.completed ? 'line-through' : ''}`}>{event.title}</span>
      {event.type === 'payment' && <span className="shrink-0 font-semibold">{formatCurrency(event.amount)}</span>}
    </button>
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-stone-800">Calendario</h1><p className="mt-1 text-sm text-stone-500">Tareas y vencimientos de pago en un solo lugar.</p></div><Button variant="secondary" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))}>Hoy</Button></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={load} className="underline">Reintentar</button></div>}
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between"><button aria-label="Mes anterior" className="rounded-xl p-2 text-stone-600 hover:bg-stone-100" onClick={() => move(-1)}><ChevronLeft /></button><h2 className="text-lg font-semibold capitalize text-stone-800">{monthLabel}</h2><button aria-label="Mes siguiente" className="rounded-xl p-2 text-stone-600 hover:bg-stone-100" onClick={() => move(1)}><ChevronRight /></button></div>
      {loading ? <p role="status" className="py-16 text-center text-stone-500">Cargando calendario…</p> : <>
        <div className="hidden grid-cols-7 border-l border-t border-stone-200 md:grid">{weekdayNames.map(name => <div key={name} className="border-b border-r border-stone-200 bg-stone-50 p-2 text-center text-xs font-semibold text-stone-500">{name}</div>)}{days.map(day => <div key={day.key} className={`min-h-28 space-y-1 border-b border-r border-stone-200 p-2 ${day.currentMonth ? 'bg-white' : 'bg-stone-50'}`}><div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs ${day.key === today ? 'bg-stone-700 font-bold text-white' : day.currentMonth ? 'text-stone-700' : 'text-stone-300'}`}>{day.date.getDate()}</div>{(byDate[day.key] || []).slice(0, 3).map(event => <Event key={event.id} event={event} compact />)}{(byDate[day.key] || []).length > 3 && <p className="px-2 text-xs text-stone-400">+{byDate[day.key].length - 3} más</p>}</div>)}</div>
        <div className="space-y-4 md:hidden">{monthEvents.length === 0 ? <div className="py-12 text-center text-stone-500"><CalendarDays className="mx-auto mb-3" />No hay fechas previstas este mes.</div> : Object.entries(byDate).filter(([date]) => date.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)).map(([date, dateEvents]) => <section key={date}><h3 className={`mb-2 text-sm font-semibold ${date === today ? 'text-olive' : 'text-stone-700'}`}>{new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><div className="space-y-2">{dateEvents.map(event => <Event key={event.id} event={event} />)}</div></section>)}</div>
      </>}
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-stone-500"><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-olive-light" /> Tarea</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gold-light" /> Pago</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-50" /> Vencido</span></div>
  </div>
}
