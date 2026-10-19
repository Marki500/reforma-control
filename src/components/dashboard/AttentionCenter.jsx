import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, FileWarning, PhoneCall } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getTasks } from '../../services/tasksService'
import { getExpenses } from '../../services/expensesService'
import { getBudgetPDFs } from '../../services/budgetPDFService'
import { supabase } from '../../services/supabaseClient'
import { buildNotifications } from '../../utils/notifications'
import { localDateKey } from '../../utils/tasks'

export default function AttentionCenter() {
  const navigate = useNavigate(), [items, setItems] = useState([]), [loading, setLoading] = useState(true), [incomplete, setIncomplete] = useState(false)
  useEffect(() => { Promise.allSettled([getTasks(), getExpenses(), getBudgetPDFs(), supabase.from('home_documents').select('expiry_date').then(({ data, error }) => { if (error) throw error; return data || [] })]).then(([tasks, expenses, budgets, documents]) => {
    const today = localDateKey(), next30 = new Date(); next30.setDate(next30.getDate() + 30); const limit = localDateKey(next30), result = []
    const pendingBudgets = budgets.status === 'fulfilled' ? budgets.value.filter(item => ['Solicitado', 'Recibido', 'Comparando'].includes(item.status || 'Recibido')).length : 0
    const expiringDocs = documents.status === 'fulfilled' ? documents.value.filter(item => item.expiry_date && item.expiry_date >= today && item.expiry_date <= limit).length : 0
    const upcoming = buildNotifications(tasks.status === 'fulfilled' ? tasks.value : [], expenses.status === 'fulfilled' ? expenses.value : [], today)
    for (const item of upcoming.slice(0, 4)) result.push({ label: item.title, detail: `${item.label} · ${new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES')}`, route: item.route, icon: item.type === 'task' ? AlertTriangle : CalendarClock, tone: item.level === 'overdue' ? 'text-red-700 bg-red-50' : 'text-olive bg-olive-light' })
    if (pendingBudgets) result.push({ label: `${pendingBudgets} ${pendingBudgets === 1 ? 'presupuesto por decidir' : 'presupuestos por decidir'}`, route: '/presupuestos', icon: PhoneCall, tone: 'text-olive bg-olive-light' })
    if (expiringDocs) result.push({ label: `${expiringDocs} ${expiringDocs === 1 ? 'documento caduca pronto' : 'documentos caducan pronto'}`, route: '/vivienda', icon: FileWarning, tone: 'text-terracotta bg-terracotta-light' })
    setItems(result)
    setIncomplete([tasks, expenses, budgets, documents].some(result => result.status === 'rejected'))
    setLoading(false)
  }) }, [])
  if (loading) return <p role="status" className="text-sm text-stone-600">Comprobando próximos pasos…</p>
  if (!items.length) return <section className="rounded-xl bg-white p-4"><h2 className="font-semibold text-stone-800">Próximos pasos</h2><p role={incomplete ? 'alert' : 'status'} className="mt-1 text-sm text-stone-600">{incomplete ? 'No se pudieron comprobar todos los avisos. Revisa tareas, gastos y documentos.' : 'Sin tareas ni pagos vencidos o previstos para los próximos 7 días, ni presupuestos o documentos por revisar.'}</p><button type="button" onClick={() => navigate('/calendario')} className="mt-2 text-sm font-medium text-olive underline">Ver calendario</button></section>
  return <section><div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta">Necesita atención</p><h2 className="mt-1 text-lg font-semibold text-stone-800">Próximos pasos</h2></div>{incomplete && <p role="alert" className="mb-3 text-sm text-amber-800">No se pudieron comprobar todos los avisos.</p>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => { const Icon = item.icon; return <button type="button" key={`${item.route}:${item.label}:${item.detail || ''}`} onClick={() => navigate(item.route)} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-md"><span className={`rounded-xl p-2.5 ${item.tone}`}><Icon size={19} /></span><span className="min-w-0 text-sm font-medium text-stone-800">{item.label}{item.detail && <span className="mt-1 block text-xs font-normal text-stone-600">{item.detail}</span>}</span></button> })}</div></section>
}
