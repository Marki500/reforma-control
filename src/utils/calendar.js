import { expenseStatus } from './expenses.js'

export function monthDays(year, month) {
  const first = new Date(year, month, 1, 12)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset, 12)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      currentMonth: date.getMonth() === month,
    }
  })
}

export function calendarEvents(tasks, expenses) {
  const events = []
  for (const task of tasks) {
    if (!task.due_date) continue
    events.push({ id: `task-${task.id}`, sourceId: task.id, date: task.due_date, type: 'task', title: task.title, completed: task.status === 'Completada', meta: task.priority })
  }
  for (const expense of expenses) {
    if (!expense.due_date || expenseStatus(expense) === 'Pagado') continue
    events.push({
      id: `expense-${expense.id}`, sourceId: expense.id, date: expense.due_date, type: 'payment',
      title: expense.title, amount: Math.max((Number(expense.amount) || 0) - (Number(expense.paid_amount) || 0), 0),
      completed: false, meta: expense.suppliers?.name || expense.vendor || '',
    })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'))
}
