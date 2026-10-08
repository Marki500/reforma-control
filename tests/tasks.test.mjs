import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterTasks, isTaskOverdue, localDateKey } from '../src/utils/tasks.js'

const tasks = [
  { id: 1, title: 'Pedir ventanas', description: 'Comparar presupuestos', status: 'Pendiente', priority: 'Alta', room_id: 'salon', due_date: '2026-10-06' },
  { id: 2, title: 'Instalar baño', description: '', status: 'Completada', priority: 'Alta', room_id: 'bano', due_date: '2026-10-01' },
  { id: 3, title: 'Comprar pintura', description: '', status: 'En curso', priority: 'Media', room_id: null, due_date: '2026-10-07' },
]
test('completed tasks and tasks due today are not overdue', () => {
  assert.equal(isTaskOverdue(tasks[0], '2026-10-07'), true)
  assert.equal(isTaskOverdue(tasks[1], '2026-10-07'), false)
  assert.equal(isTaskOverdue(tasks[2], '2026-10-07'), false)
  assert.equal(isTaskOverdue({ status: 'Pendiente', due_date: null }, '2026-10-07'), false)
  assert.equal(localDateKey(new Date(2026, 9, 7, 0, 15)), '2026-10-07')
})
test('task filters combine, including description search and overdue state', () => {
  assert.deepEqual(filterTasks(tasks, { search: ' PRESUPUESTOS ', status: 'Pendiente', priority: 'Alta', room_id: 'salon', overdue: true }, '2026-10-07').map(task => task.id), [1])
  assert.equal(filterTasks(tasks, { room_id: 'bano', overdue: true }, '2026-10-07').length, 0)
  assert.deepEqual(filterTasks(tasks, { status: 'En curso' }).map(task => task.id), [3])
})
