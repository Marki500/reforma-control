// Materials are an estimate, independently of invoices and recorded payments.
export function materialEstimate(material) {
  return material.count_in_total === false ? 0 : (Number(material.price) || 0) * (Number(material.quantity) || 1)
}

export function recordedExpensesSummary(expenses) {
  return expenses.reduce((summary, expense) => {
    const amount = Number(expense.amount) || 0
    const paid = Number(expense.paid_amount) || 0
    summary.committed += amount
    summary.paid += paid
    // An overpayment on one invoice must not cancel another invoice's debt.
    summary.pending += Math.max(amount - paid, 0)
    return summary
  }, { committed: 0, paid: 0, pending: 0 })
}
