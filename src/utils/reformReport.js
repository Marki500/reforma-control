import { expenseStatus } from './expenses.js'

export const cents = value => Math.round((Number(value) || 0) * 100)
export const money = value => value / 100

export function buildReformReport({ project, expenses = [], invoices = [], tasks = [], generatedAt = new Date().toISOString() }) {
  const invoicesByExpense = new Map(invoices.map(invoice => [invoice.expense_id, invoice]))
  const rows = expenses.map(expense => {
    const invoice = invoicesByExpense.get(expense.id)
    const amount = cents(expense.amount), paid = cents(expense.paid_amount)
    return { id: expense.id, title: expense.title || 'Sin concepto', category: expense.category || 'Sin categoría', supplier: expense.suppliers?.name || expense.vendor || '', room: expense.rooms?.name || '', date: expense.expense_date || '', dueDate: expense.due_date || '', budgeted: cents(expense.budgeted_amount), amount, paid, pending: Math.max(amount - paid, 0), status: expenseStatus(expense), invoiceNumber: invoice?.invoice_number || '', notes: expense.notes || '' }
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'))
  const totals = rows.reduce((sum, row) => {
    for (const key of ['budgeted', 'amount', 'paid', 'pending']) sum[key] += row[key]
    return sum
  }, { budgeted: 0, amount: 0, paid: 0, pending: 0 })
  totals.invoiced = invoices.reduce((sum, invoice) => sum + cents(invoice.total_amount), 0)
  const categories = [...new Set(rows.map(row => row.category))].sort().map(name => ({ name, ...rows.filter(row => row.category === name).reduce((sum, row) => {
    for (const key of ['amount', 'paid', 'pending']) sum[key] += row[key]
    return sum
  }, { amount: 0, paid: 0, pending: 0 }) }))
  const done = tasks.filter(task => task.status === 'Completada').length
  const budget = project.estimated_budget == null ? null : cents(project.estimated_budget)
  return { project, generatedAt, rows, totals, categories, budget, balance: budget === null ? null : budget - totals.amount, tasks: { total: tasks.length, done, percentage: tasks.length ? Math.round(done / tasks.length * 100) : null } }
}

// Paginate explicitly: Supabase's default row cap must not truncate an export.
export async function readReportRows(client, table, projectId, columns = '*') {
  const rows = [], size = 500
  for (let start = 0; ; start += size) {
    const { data, error } = await client.from(table).select(columns).eq('project_id', projectId).order('id').range(start, start + size - 1)
    if (error) throw new Error(`No se pudieron cargar todos los datos de ${table}: ${error.message}`)
    if (!Array.isArray(data)) throw new Error(`Respuesta incompleta al cargar ${table}.`)
    rows.push(...data)
    if (data.length < size) return rows
  }
}
