import { expenseStatus } from './expenses.js'

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function timing(date, today) {
  if (date < today) return { level: 'overdue', label: 'Vencido' }
  if (date === today) return { level: 'today', label: 'Hoy' }
  return { level: 'soon', label: 'Próximamente' }
}

export function buildNotifications(tasks, expenses, today, horizonDays = 7) {
  const limit = addDays(today, horizonDays)
  const items = []
  for (const task of tasks) {
    if (!task.due_date || task.status === 'Completada' || task.due_date > limit) continue
    items.push({ id: `task:${task.id}:${task.due_date}`, sourceId: task.id, type: 'task', date: task.due_date, title: task.title, route: '/tareas', ...timing(task.due_date, today) })
  }
  for (const expense of expenses) {
    if (!expense.due_date || expenseStatus(expense) === 'Pagado' || expense.due_date > limit) continue
    const amount = Math.max((Number(expense.amount) || 0) - (Number(expense.paid_amount) || 0), 0)
    items.push({ id: `payment:${expense.id}:${expense.due_date}`, sourceId: expense.id, type: 'payment', date: expense.due_date, title: expense.title, amount, route: '/gastos', ...timing(expense.due_date, today) })
  }
  const rank = { overdue: 0, today: 1, soon: 2 }
  return items.sort((a, b) => rank[a.level] - rank[b.level] || a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'))
}
