import test from 'node:test'
import assert from 'node:assert/strict'
import { addWall, detectRooms, emptyPlan, examplePlan, fitOpening, moveJunctions, polygonArea, reconcilePlan, roomArea, validatePlan, wallEndpointChanges } from '../src/utils/floorPlan.js'

function rectangle() {
  let plan = emptyPlan()
  const corners = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }]
  corners.forEach((p, i) => { plan = addWall(plan, p, corners[(i + 1) % 4]) })
  return reconcilePlan(plan)
}
test('only enclosed spaces become rooms, with the correct area', () => {
  const plan = rectangle()
  assert.equal(plan.rooms.length, 1)
  assert.equal(polygonArea(plan.rooms[0].points), 24)
  assert.equal(detectRooms(plan.walls.slice(1)).length, 0)
  assert.equal(validatePlan(plan), true)
})
test('T junctions divide a room and shared walls are not duplicated', () => {
  let plan = rectangle()
  const unchanged = addWall(plan, { x: 1, y: 0 }, { x: 4, y: 0 })
  assert.equal(unchanged, plan)
  plan = reconcilePlan(addWall(plan, { x: 3, y: 0 }, { x: 3, y: 4 }))
  assert.equal(plan.rooms.length, 2)
  assert.deepEqual(plan.rooms.map(r => polygonArea(r.points)), [12, 12])
  const opened = reconcilePlan({ ...plan, walls: plan.walls.slice(0, -1) })
  assert.equal(opened.rooms.length, 1)
})
test('moving a junction preserves connected walls, room name and application link', () => {
  const plan = rectangle()
  plan.rooms[0].name = 'Cocina'; plan.rooms[0].roomId = 'kitchen'
  const moved = moveJunctions(plan, [{ from: { x: 6, y: 0 }, to: { x: 7, y: 0 } }, { from: { x: 6, y: 4 }, to: { x: 7, y: 4 } }])
  assert.equal(polygonArea(moved.rooms[0].points), 28)
  assert.equal(moved.rooms[0].name, 'Cocina')
  assert.equal(moved.rooms[0].roomId, 'kitchen')
  assert.equal(validatePlan(moved), true)
})
test('openings stay within their wall and cannot overlap', () => {
  const plan = rectangle(), wallId = plan.walls[0].id
  plan.openings.push({ id: 'door', type: 'door', wallId, offset: 1, width: 0.8, flip: false })
  assert.equal(fitOpening(plan, wallId, 1.5, 1.2), null)
  assert.equal(fitOpening(plan, wallId, 0, 6), null)
  assert.equal(fitOpening(plan, 'missing', 1, 1), null)
  assert.deepEqual(fitOpening(plan, wallId, 100, 1), { offset: 4.95, width: 1 })
  assert.equal(validatePlan(plan), true)
  const deleted = reconcilePlan({ ...plan, walls: plan.walls.slice(1) })
  assert.equal(deleted.openings.length, 0)
})
test('invalid imported data is rejected and the editable example is valid', () => {
  for (const data of [null, {}, { ...emptyPlan(), walls: [null] }, { ...emptyPlan(), version: 8 }, { ...rectangle(), rooms: [{ id: 'bad', name: 'test' }] }]) assert.equal(validatePlan(data), false)
  const plan = examplePlan()
  assert.equal(validatePlan(plan), true)
  assert.equal(plan.rooms.length, 2)
  assert.equal(plan.rooms.reduce((sum, r) => sum + polygonArea(r.points), 0), 24)
  assert.equal(validatePlan(JSON.parse(JSON.stringify(plan))), true)
})
test('an internal enclosure does not double-count the surrounding floor area', () => {
  let plan = rectangle()
  const corners = [{ x: 2, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 2, y: 3 }]
  corners.forEach((p, i) => { plan = addWall(plan, p, corners[(i + 1) % 4]) })
  plan = reconcilePlan(plan)
  assert.equal(plan.rooms.length, 2)
  assert.deepEqual(plan.rooms.map(roomArea), [20, 4])
  assert.equal(validatePlan(plan), true)
})
test('a partition follows the outer wall at its T junction when moved', () => {
  const plan = examplePlan(), top = plan.walls[0]
  const moved = moveJunctions(plan, wallEndpointChanges(plan, top, { x: 2, y: 1 }, { x: 8, y: 1 }))
  assert.equal(moved.walls[4].a.y, 1)
  assert.equal(moved.rooms.length, 2)
  assert.equal(moved.rooms.reduce((sum, room) => sum + roomArea(room), 0), 30)
  assert.equal(validatePlan(moved), true)
})
