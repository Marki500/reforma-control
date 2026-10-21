import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentPhases, phasePaid, phaseDue, paymentProgress, validatePaymentPhases, pendingPayments } from '../src/utils/paymentPhases.js'
import { calendarEvents } from '../src/utils/calendar.js'
import { buildNotifications } from '../src/utils/notifications.js'

test('phase templates preserve cents and previously paid amounts without inventing dates', () => {
  const phases = createPaymentPhases({ amount: 100.01, paid_amount: 0 })
  assert.equal(validatePaymentPhases(phases, 100.01), '')
  const legacy = createPaymentPhases({ amount: 1000, paid_amount: 350, due_date: '2026-12-01' })
  assert.equal(phasePaid(legacy), 350)
  assert.equal(legacy[0].paid_date, null)
  assert.equal(legacy[1].amount, 650)
  assert.equal(legacy[1].due_date, '2026-12-01')
  assert.equal(createPaymentPhases({ amount: 0 }).length, 0)
  assert.equal(createPaymentPhases({ amount: 0.01 })[0].amount, 0.01)
  assert.match(validatePaymentPhases([{ title: 'Mal', amount: 0 }], 100), /mayor/)
  assert.match(validatePaymentPhases(phases, 110), /coincidir/)
})

test('progress is weighted by money and identifies the first unpaid phase, even out of order', () => {
  const phases = [{ id: 'a', title: 'Anticipo', amount: 100, paid: true }, { id: 'b', title: 'Obra', amount: 700, paid: false, due_date: '2026-11-03' }, { id: 'c', title: 'Final', amount: 200, paid: true }]
  const progress = paymentProgress({ amount: 1000, paid_amount: phasePaid(phases), payment_phases: phases })
  assert.equal(progress.percent, 30)
  assert.equal(progress.completed, 2)
  assert.equal(progress.next.title, 'Obra')
  assert.equal(phaseDue(phases), '2026-11-03')
  assert.equal(paymentProgress({ amount: 0, paid_amount: 0 }).percent, 0)
})

test('calendar and notifications use each outstanding phase amount, not the entire remaining expense', () => {
  const expense = { id: 'e', title: 'Obra', amount: 1000, paid_amount: 100, due_date: '2026-10-22', payment_phases: [{ id: 'a', title: 'Anticipo', amount: 100, paid: true, due_date: '2026-10-20' }, { id: 'b', title: 'Obra', amount: 700, paid: false, due_date: '2026-10-22' }, { id: 'c', title: 'Final', amount: 200, paid: false, due_date: '2026-11-20' }] }
  assert.equal(pendingPayments(expense).length, 2)
  assert.equal(calendarEvents([], [expense]).length, 2)
  const alerts = buildNotifications([], [expense], '2026-10-21')
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].amount, 700)
  assert.match(alerts[0].title, /Obra/)
})
