import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney, moneyCents, validMoney } from '../src/utils/money.js'
import { expenseAmounts, expenseTotals } from '../src/utils/expenses.js'
import { createPaymentPhases, validatePaymentPhases, phasePaid } from '../src/utils/paymentPhases.js'
import { recordedExpensesSummary } from '../src/utils/dashboardFinance.js'

test('Spanish, English, pasted currency and spaced thousands represent the same amount', () => {
  for (const value of [1234.56, '1234,56', '1234.56', '1.234,56', '1,234.56', '1 234,56', '1\u00a0234,56 €', '€ 1.234,56']) {
    assert.equal(parseMoney(value), 1234.56, String(value))
    assert.equal(moneyCents(value), 123456)
    assert.equal(validMoney(value), true)
  }
  assert.equal(parseMoney('1.234'), 1234)
  assert.equal(parseMoney('1,234'), 1234)
  assert.equal(parseMoney(''), 0)
  assert.equal(parseMoney(null), 0)
})

test('invalid money cannot silently become zero or be partially parsed', () => {
  for (const value of ['texto', '12 euros', '12.34,56', '12,34.56', '12,3456', '1e3', '1 2', '€', Infinity, NaN, {}, true]) {
    assert.equal(Number.isNaN(parseMoney(value)), true, String(value))
    assert.equal(validMoney(value), false)
  }
  for (const value of [-1, '-0,01', 1.005, '10000000000']) assert.equal(validMoney(value), false)
  assert.equal(validMoney('9.999.999.999,99'), true)
})

test('mixed formats normalize consistently for saving, phase validation and paid totals', () => {
  const form = { budgeted_amount: '2.000,00', amount: '1.234,56', paid_amount: '234,56', payment_phases: [
    { title: ' Anticipo ', amount: '234,56', paid: true },
    { title: 'Final', amount: '1,000.00', paid: false },
  ] }
  assert.deepEqual(expenseAmounts(form), {
    budgeted_amount: 2000, amount: 1234.56, paid_amount: 234.56,
    payment_phases: [{ title: 'Anticipo', amount: 234.56, paid: true }, { title: 'Final', amount: 1000, paid: false }],
  })
  assert.equal(validatePaymentPhases(form.payment_phases, form.amount), '')
  assert.equal(phasePaid(form.payment_phases), 234.56)
  assert.equal(validatePaymentPhases(createPaymentPhases(form), form.amount), '')
  assert.throws(() => expenseAmounts({ ...form, amount: 'no' }), /Coste final/)
  assert.throws(() => expenseAmounts({ ...form, payment_phases: [{ title: 'Obra', amount: 1.001, paid: false }] }), /dos decimales/)
  assert.throws(() => expenseAmounts({ ...form, payment_phases: [], paid_amount: '1.235,00' }), /superar/)
  assert.throws(() => expenseAmounts({ ...form, payment_phases: [], amount: '234,55' }), /superar/)
})

test('totals and remaining payments add integer cents without floating point drift', () => {
  const expenses = [{ amount: 0.1, paid_amount: 0.03, budgeted_amount: 0.1 }, { amount: 0.2, paid_amount: 0.07, budgeted_amount: 0.2 }]
  assert.deepEqual(expenseTotals(expenses), { actual: 0.3, paid: 0.1, budgeted: 0.3 })
  assert.deepEqual(recordedExpensesSummary(expenses), { committed: 0.3, paid: 0.1, pending: 0.2 })
})
