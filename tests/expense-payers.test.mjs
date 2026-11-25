import test from 'node:test'
import assert from 'node:assert/strict'
import { expensePayerBreakdown } from '../src/utils/expensePayers.js'

test('contributions use paid amounts, preserve cents and keep pending amounts separate', () => {
  const people = expensePayerBreakdown([
    { payer_user_id: 'a', amount: '100,30', paid_amount: '50,10' },
    { payer_user_id: 'a', amount: '0,20', paid_amount: '0,20' },
    { payer_user_id: 'b', amount: '200', paid_amount: '100,60' },
    { payer_user_id: null, amount: '50,30', paid_amount: '50,30' },
  ], [{ user_id: 'a', display_name: 'Ana' }, { user_id: 'b', display_name: 'Marc' }])
  assert.deepEqual(people.map(person => person.label), ['Marc', 'Ana', 'Sin asignar'])
  const ana = people.find(person => person.id === 'a')
  assert.equal(ana.paid, 50.3)
  assert.equal(ana.committed, 100.5)
  assert.equal(ana.pending, 50.2)
  assert.equal(ana.paidShare, 0.25)
  assert.equal(people.reduce((sum, person) => sum + person.paidShare, 0), 1)
})

test('missing or former payers never disappear and zero payments do not divide by zero', () => {
  const people = expensePayerBreakdown([
    { payer_user_id: 'former-a', amount: 100, paid_amount: 0 },
    { payer_user_id: 'former-b', amount: 50, paid_amount: 0 },
    { payer_user_id: '', amount: 20, paid_amount: 0 },
  ], [{ user_id: 'active', display_name: 'Ana' }])
  assert.equal(people.length, 4)
  assert.equal(people.find(person => person.id === '').pending, 20)
  assert.equal(people.find(person => person.id === 'former-a').pending, 100)
  assert.notEqual(people.find(person => person.id === 'former-a').label, people.find(person => person.id === 'former-b').label)
  assert.ok(people.every(person => person.paidShare === 0))
  assert.deepEqual(expensePayerBreakdown([], []), [])
})
