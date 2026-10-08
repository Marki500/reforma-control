export function expenseStatus(expense) {
  const amount = Number(expense.amount) || 0
  const paid = Number(expense.paid_amount) || 0
  if (amount > 0 && paid >= amount) return 'Pagado'
  if (paid > 0) return 'Parcial'
  return 'Pendiente'
}

export function expenseTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    totals.budgeted += Number(expense.budgeted_amount) || 0
    totals.actual += Number(expense.amount) || 0
    totals.paid += Number(expense.paid_amount) || 0
    return totals
  }, { budgeted: 0, actual: 0, paid: 0 })
}

export function filterExpenses(expenses, filters) {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return expenses.filter(expense => {
    const haystack = `${expense.title} ${expense.vendor} ${expense.suppliers?.name || ''} ${expense.notes}`.toLocaleLowerCase('es')
    return (!search || haystack.includes(search))
      && (!filters.status || expenseStatus(expense) === filters.status)
      && (!filters.category || expense.category === filters.category)
      && (!filters.room_id || expense.room_id === filters.room_id)
  })
}
