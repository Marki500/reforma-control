import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildNotifications } from '../src/utils/notifications.js'

test('notifications include overdue and next seven days but exclude completed or paid items', () => {
  const result = buildNotifications([
    { id: 'late', title: 'Tarea vencida', due_date: '2026-10-07', status: 'Pendiente' },
    { id: 'done', title: 'Terminada', due_date: '2026-10-08', status: 'Completada' },
    { id: 'future', title: 'Muy futura', due_date: '2026-10-20', status: 'Pendiente' },
  ], [
    { id: 'pay', title: 'Factura', due_date: '2026-10-10', amount: 500, paid_amount: 100 },
    { id: 'paid', title: 'Pagada', due_date: '2026-10-08', amount: 200, paid_amount: 200 },
  ], '2026-10-08')
  assert.deepEqual(result.map(item => item.id), ['task:late:2026-10-07', 'payment:pay:2026-10-10'])
  assert.equal(result[0].level, 'overdue')
  assert.equal(result[1].amount, 400)
})
