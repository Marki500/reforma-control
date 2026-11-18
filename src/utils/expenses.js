import { moneyCents, validMoney } from './money.js'
import { phasesOf, validatePaymentPhases } from './paymentPhases.js'

export function expenseAmounts(form) {
  const result = {}
  for (const [key, label] of [['budgeted_amount', 'Importe previsto'], ['amount', 'Coste final'], ['paid_amount', 'Cantidad pagada']]) {
    if (!validMoney(form[key])) throw new Error(`${label}: escribe un importe válido, sin negativos y con un máximo de dos decimales (ej.: 1.234,56 o 1234.56).`)
    result[key] = moneyCents(form[key]) / 100
  }
  const phases = phasesOf(form)
  const error = validatePaymentPhases(phases, result.amount)
  if (error) throw new Error(error)
  result.payment_phases = phases.map(phase => ({ ...phase, title: phase.title.trim(), amount: moneyCents(phase.amount) / 100 }))
  if (phases.length) result.paid_amount = result.payment_phases.reduce((sum, phase) => sum + (phase.paid ? moneyCents(phase.amount) : 0), 0) / 100
  if (moneyCents(result.paid_amount) > moneyCents(result.amount)) throw new Error('La cantidad pagada no puede superar el coste final.')
  return result
}

export function expenseStatus(expense) {
  const amount = moneyCents(expense.amount)
  const paid = moneyCents(expense.paid_amount)
  if (amount > 0 && paid >= amount) return 'Pagado'
  if (paid > 0) return 'Parcial'
  return 'Pendiente'
}

export function expenseTotals(expenses) {
  const cents = expenses.reduce((totals, expense) => {
    totals.budgeted += moneyCents(expense.budgeted_amount)
    totals.actual += moneyCents(expense.amount)
    totals.paid += moneyCents(expense.paid_amount)
    return totals
  }, { budgeted: 0, actual: 0, paid: 0 })
  return Object.fromEntries(Object.entries(cents).map(([key, value]) => [key, value / 100]))
}

export function filterExpenses(expenses, filters) {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return expenses.filter(expense => {
    const haystack = `${expense.title} ${expense.vendor} ${expense.suppliers?.name || ''} ${expense.notes}`.toLocaleLowerCase('es')
    return (!search || haystack.includes(search))
      && (!filters.status || expenseStatus(expense) === filters.status)
      && (!filters.category || expense.category === filters.category)
      && (!filters.payer_user_id || (filters.payer_user_id === 'unassigned' ? !expense.payer_user_id : expense.payer_user_id === filters.payer_user_id))
      && (!filters.room_id || expense.room_id === filters.room_id)
  })
}
