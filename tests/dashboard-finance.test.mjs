import assert from 'node:assert/strict'
import { test } from 'node:test'
import { materialEstimate, recordedExpensesSummary } from '../src/utils/dashboardFinance.js'

test('material estimates respect exclusions and do not depend on purchasing status', () => {
  assert.equal(materialEstimate({ price: '249', quantity: 2, status: 'Mirando' }), 498)
  assert.equal(materialEstimate({ price: 249, quantity: 2, count_in_total: false }), 0)
  assert.equal(materialEstimate({ price: null }), 0)
})

test('recorded commitments and payments stay separate from material estimates', () => {
  assert.deepEqual(recordedExpensesSummary([]), { committed: 0, paid: 0, pending: 0 })
  assert.deepEqual(recordedExpensesSummary([
    { amount: '100', paid_amount: '120' },
    { amount: '200', paid_amount: '50' },
  ]), { committed: 300, paid: 170, pending: 150 })
})
