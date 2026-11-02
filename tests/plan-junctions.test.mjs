import test from 'node:test'
import assert from 'node:assert/strict'
import { addWall, emptyPlan, reconcilePlan, samePoint, validatePlan } from '../src/utils/floorPlan.js'
import { planJunctions, movePlanJunction } from '../src/utils/planEditing.js'

function planOf(segments) {
  let plan = emptyPlan()
  for (const [a, b] of segments) plan = addWall(plan, a, b)
  return reconcilePlan(plan)
}
const p = (x, y) => ({ x, y })
const tPlan = () => planOf([[p(0, 0), p(6, 0)], [p(3, 0), p(3, 3)]])

test('T and X intersections have one point; isolated wall ends are not junctions', () => {
  assert.equal(planJunctions(tPlan()).length, 1)
  const cross = planOf([[p(0, 0), p(6, 0)], [p(3, -3), p(3, 3)]])
  assert.equal(planJunctions(cross).length, 1)
  assert.deepEqual(planJunctions(cross)[0].point, p(3, 0))
  assert.equal(planJunctions(planOf([[p(0, 0), p(2, 0)]])).length, 0)
})

test('moving a T point splits its host and keeps all three branches joined', () => {
  const original = tPlan(), before = structuredClone(original), moved = movePlanJunction(original, p(3, 0), p(3.5, 0.5))
  assert.equal(moved.walls.length, 3)
  assert.equal(moved.walls.filter(wall => samePoint(wall.a, p(3.5, 0.5)) || samePoint(wall.b, p(3.5, 0.5))).length, 3)
  assert.equal(planJunctions(moved).length, 1)
  assert.ok(validatePlan(moved))
  assert.deepEqual(original, before)
  const again = movePlanJunction(moved, p(3.5, 0.5), p(3.6, 0.6))
  assert.equal(again.walls.length, 3, 'moving an existing node does not keep splitting its walls')
})

test('moving an X point keeps all four branches joined', () => {
  const moved = movePlanJunction(planOf([[p(0, 0), p(6, 0)], [p(3, -3), p(3, 3)]]), p(3, 0), p(3.4, 0.2))
  assert.equal(moved.walls.length, 4)
  assert.equal(moved.walls.filter(wall => samePoint(wall.a, p(3.4, 0.2)) || samePoint(wall.b, p(3.4, 0.2))).length, 4)
  assert.ok(validatePlan(JSON.parse(JSON.stringify(moved))))
})

test('doors on both sides retain their IDs, sides and offsets when a host is split', () => {
  const original = tPlan(), wall = original.walls[0]
  original.openings = [{ id: 'left', wallId: wall.id, type: 'door', offset: 0.5, width: 0.8 }, { id: 'right', wallId: wall.id, type: 'window', offset: 4, width: 0.8 }]
  const moved = movePlanJunction(original, p(3, 0), p(3, 0.2))
  assert.equal(moved.openings.length, 2)
  assert.equal(moved.openings[0].id, 'left')
  assert.equal(moved.openings[1].id, 'right')
  assert.equal(moved.openings[1].offset, 1)
  assert.notEqual(moved.openings[1].wallId, wall.id)
  assert.ok(validatePlan(moved))
})

test('junction edits preserve room identity, name and application link', () => {
  const plan = planOf([[p(0, 0), p(4, 0)], [p(4, 0), p(4, 4)], [p(4, 4), p(0, 4)], [p(0, 4), p(0, 0)]])
  plan.rooms[0].name = 'Salón'; plan.rooms[0].roomId = 'living-room'
  const moved = movePlanJunction(plan, p(4, 4), p(4.5, 4.5))
  assert.equal(moved.rooms.length, 1)
  assert.equal(moved.rooms[0].id, plan.rooms[0].id)
  assert.equal(moved.rooms[0].name, 'Salón')
  assert.equal(moved.rooms[0].roomId, 'living-room')
})

test('locked geometry, cuts through openings and collapsing walls are rejected without mutation', () => {
  const locked = tPlan(); locked.walls[0].locked = true
  assert.throws(() => movePlanJunction(locked, p(3, 0), p(3, 1)), /bloque/)
  const withDoor = tPlan()
  withDoor.openings = [{ id: 'door', wallId: withDoor.walls[0].id, type: 'door', offset: 2.5, width: 1 }]
  const before = structuredClone(withDoor)
  assert.throws(() => movePlanJunction(withDoor, p(3, 0), p(3, 1)), /puerta o ventana/)
  assert.deepEqual(withDoor, before)
  assert.throws(() => movePlanJunction(tPlan(), p(3, 0), p(3, 3)), /colapsa/)
})
