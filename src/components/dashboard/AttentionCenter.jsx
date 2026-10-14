import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, FileWarning, PhoneCall } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getTasks } from '../../services/tasksService'
import { getExpenses } from '../../services/expensesService'
import { getBudgetPDFs } from '../../services/budgetPDFService'
import { getHomeDocuments } from '../../services/homeDocumentsService'
import { isTaskOverdue, localDateKey } from '../../utils/tasks'

export default function AttentionCenter() {
  const navigate = useNavigate(), [items, setItems] = useState([])
  useEffect(() => { Promise.allSettled([getTasks(), getExpenses(), getBudgetPDFs(), getHomeDocuments()]).then(([tasks, expenses, budgets, documents]) => {
    const today = localDateKey(), next30 = new Date(); next30.setDate(next30.getDate() + 30); const limit = next30.toISOString().slice(0, 10), result = []
    const overdueTasks = tasks.status === 'fulfilled' ? tasks.value.filter(isTaskOverdue).length : 0
    const duePayments = expenses.status === 'fulfilled' ? expenses.value.filter(item => item.due_date && item.due_date <= limit && Number(item.paid_amount) < Number(item.amount)).length : 0
    const pendingBudgets = budgets.status === 'fulfilled' ? budgets.value.filter(item => ['Solicitado', 'Recibido', 'Comparando'].includes(item.status || 'Recibido')).length : 0
    const expiringDocs = documents.status === 'fulfilled' ? documents.value.filter(item => item.expiry_date && item.expiry_date >= today && item.expiry_date <= limit).length : 0
    if (overdueTasks) result.push({ label: `${overdueTasks} ${overdueTasks === 1 ? 'tarea vencida' : 'tareas vencidas'}`, route: '/tareas', icon: AlertTriangle, tone: 'text-red-700 bg-red-50' })
    if (duePayments) result.push({ label: `${duePayments} ${duePayments === 1 ? 'pago próximo' : 'pagos próximos'}`, route: '/gastos', icon: CalendarClock, tone: 'text-amber-700 bg-amber-50' })
    if (pendingBudgets) result.push({ label: `${pendingBudgets} ${pendingBudgets === 1 ? 'presupuesto por decidir' : 'presupuestos por decidir'}`, route: '/presupuestos', icon: PhoneCall, tone: 'text-olive bg-olive-light' })
    if (expiringDocs) result.push({ label: `${expiringDocs} ${expiringDocs === 1 ? 'documento caduca pronto' : 'documentos caducan pronto'}`, route: '/vivienda', icon: FileWarning, tone: 'text-terracotta bg-terracotta-light' })
    setItems(result)
  }) }, [])
  if (!items.length) return null
  return <section><div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta">Necesita atención</p><h2 className="mt-1 text-lg font-semibold text-stone-800">Próximos pasos</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(item => { const Icon = item.icon; return <button type="button" key={item.label} onClick={() => navigate(item.route)} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-md"><span className={`rounded-xl p-2.5 ${item.tone}`}><Icon size={19} /></span><span className="text-sm font-medium text-stone-700">{item.label}</span></button> })}</div></section>
}
