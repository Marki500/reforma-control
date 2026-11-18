import { moneyCents } from './money.js'

// Materials are an estimate, independently of invoices and recorded payments.
export function materialEstimate(material) {
  return material.count_in_total === false ? 0 : (Number(material.price) || 0) * (Number(material.quantity) || 1)
}

export function recordedExpensesSummary(expenses) {
  const cents = expenses.reduce((summary, expense) => {
    const amount = moneyCents(expense.amount)
    const paid = moneyCents(expense.paid_amount)
    summary.committed += amount
    summary.paid += paid
    // An overpayment on one invoice must not cancel another invoice's debt.
    summary.pending += Math.max(amount - paid, 0)
    return summary
  }, { committed: 0, paid: 0, pending: 0 })
  return Object.fromEntries(Object.entries(cents).map(([key, value]) => [key, value / 100]))
}
