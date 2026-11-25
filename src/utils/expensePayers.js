import { recordedExpensesSummary } from './dashboardFinance.js'
import { memberName } from './memberName.js'

export function expensePayerBreakdown(expenses, members) {
  const people = new Map(members.map(member => [member.user_id, { id: member.user_id, label: memberName(member), expenses: [] }]))
  let formerMembers = 0
  for (const expense of expenses) {
    const id = expense.payer_user_id || ''
    if (!people.has(id)) people.set(id, { id, label: id ? `Antiguo miembro ${++formerMembers}` : 'Sin asignar', expenses: [] })
    people.get(id).expenses.push(expense)
  }
  const totalPaid = recordedExpensesSummary(expenses).paid
  return [...people.values()].map(person => {
    const totals = recordedExpensesSummary(person.expenses)
    return { id: person.id, label: person.label, ...totals, paidShare: totalPaid > 0 ? totals.paid / totalPaid : 0 }
  }).sort((a, b) => b.paid - a.paid || b.committed - a.committed || a.label.localeCompare(b.label, 'es'))
}
