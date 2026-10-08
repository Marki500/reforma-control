import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calendarEvents, monthDays } from '../src/utils/calendar.js'

test('calendar grid starts on Monday and always contains six weeks', () => {
  const days = monthDays(2026, 9)
  assert.equal(days.length, 42)
  assert.equal(days[0].key, '2026-09-28')
  assert.equal(days[0].date.getDay(), 1)
  assert.equal(days.filter(day => day.currentMonth).length, 31)
})

test('calendar combines task deadlines and unpaid payment deadlines', () => {
  const events = calendarEvents(
    [{ id: 't1', title: 'Pintar', due_date: '2026-10-08', status: 'Pendiente', priority: 'Alta' }],
    [
      { id: 'e1', title: 'Electricista', due_date: '2026-10-09', amount: 1000, paid_amount: 400, vendor: 'Luz SL' },
      { id: 'e2', title: 'Suelo', due_date: '2026-10-10', amount: 500, paid_amount: 500 },
    ],
  )
  assert.equal(events.length, 2)
  assert.equal(events[1].amount, 600)
  assert.equal(events[1].type, 'payment')
})
