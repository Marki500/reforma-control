import assert from 'node:assert/strict'
import { test } from 'node:test'
import { expenseStatus, expenseTotals, filterExpenses } from '../src/utils/expenses.js'

const expenses = [
  { title: 'Azulejos', vendor: 'Tienda Sur', notes: '', category: 'Material', room_id: 'bano', budgeted_amount: 500, amount: 450, paid_amount: 450 },
  { title: 'Electricista', vendor: 'Luz SL', notes: 'Segundo pago', category: 'Mano de obra', room_id: 'salon', budgeted_amount: 900, amount: 1000, paid_amount: 400 },
  { title: 'Licencia', vendor: 'Ayuntamiento', notes: '', category: 'Licencia', room_id: null, budgeted_amount: 100, amount: 120, paid_amount: 0 },
]

test('expense status is derived from amounts', () => {
  assert.equal(expenseStatus(expenses[0]), 'Pagado')
  assert.equal(expenseStatus(expenses[1]), 'Parcial')
  assert.equal(expenseStatus(expenses[2]), 'Pendiente')
})

test('expense totals and filters combine correctly', () => {
  assert.deepEqual(expenseTotals(expenses), { budgeted: 1500, actual: 1570, paid: 850 })
  assert.deepEqual(filterExpenses(expenses, { search: 'segundo', status: 'Parcial', category: 'Mano de obra', room_id: 'salon' }).map(item => item.title), ['Electricista'])
})

test('payer filters keep assigned and unassigned expenses separate', () => {
  const items = expenses.map((expense, index) => ({ ...expense, payer_user_id: index === 0 ? 'user-a' : index === 1 ? 'user-b' : null }))
  assert.deepEqual(filterExpenses(items, { search: '', payer_user_id: 'user-a' }).map(item => item.title), ['Azulejos'])
  assert.deepEqual(filterExpenses(items, { search: '', payer_user_id: 'unassigned' }).map(item => item.title), ['Licencia'])
  assert.equal(filterExpenses(items, { search: '', payer_user_id: '' }).length, 3)
  assert.equal(filterExpenses(items, { search: '', payer_user_id: 'user-a', status: 'Pendiente' }).length, 0)
})
