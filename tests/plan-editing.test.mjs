import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { examplePlan, validatePlan, roomArea, openingParts, openingElevation, reconcilePlan } from '../src/utils/floorPlan.js'
import { transformRoom, lockedChangeError, roomInteriorDimensions, furnitureWarnings } from '../src/utils/planEditing.js'
import { furnitureCatalog } from '../src/utils/planFurniture.js'
import { buildPlanScene, disposeScene, wallSolidSections } from '../src/utils/plan3d.js'

function furnished() {
  const plan = examplePlan()
  plan.furniture = [{ id: 'sofa', type: 'sofa', name: 'Sofá', x: 3.5, y: 4, ...Object.fromEntries(['width', 'depth', 'height'].map(k => [k, furnitureCatalog.sofa[k]])), rotation: 0 }]
  return plan
}
test('separating a room retains its neighbour, shared wall, door configurations and moves its furniture', () => {
  const plan = furnished(), original = JSON.stringify(plan), room = plan.rooms[0], neighbour = plan.rooms[1]
  Object.assign(plan.openings[1], { doorType: 'double', fixedSide: 'left', fixedWidth: 0.1 })
  const moved = transformRoom(plan, room.id, 10, 0)
  assert.equal(moved.rooms.length, 2)
  assert.deepEqual(moved.rooms.find(r => r.id === neighbour.id).points, neighbour.points)
  assert.equal(roomArea(moved.rooms.find(r => r.id === room.id)), roomArea(room))
  assert.equal(moved.furniture[0].x, 13.5)
  assert.equal(moved.openings.filter(o => o.doorType === 'double').length, 2, 'shared door is retained for neighbour and copied with moved room')
  assert.equal(moved.openings.filter(o => o.fixedSide === 'left').length, 2)
  assert.equal(validatePlan(moved), true)
  assert.equal(JSON.parse(original).walls.length, plan.walls.length)
})
test('duplicate creates independent IDs, preserves the original and clears linked application room', () => {
  const plan = furnished(); plan.rooms[0].roomId = 'linked'; plan.rooms[0].locked = true
  const before = structuredClone(plan), copy = transformRoom(plan, plan.rooms[0].id, 10, 0, { duplicate: true })
  assert.deepEqual(plan, before)
  assert.equal(copy.rooms.length, 3); assert.equal(copy.furniture.length, 2)
  const room = copy.rooms.find(r => r.name.endsWith('(copia)'))
  assert.equal(room.roomId, ''); assert.equal(room.locked, false)
  assert.equal(roomArea(room), roomArea(plan.rooms[0]))
  assert.equal(new Set([...copy.walls, ...copy.openings, ...copy.rooms, ...copy.furniture].map(o => o.id)).size, copy.walls.length + copy.openings.length + copy.rooms.length + copy.furniture.length)
  assert.equal(validatePlan(copy), true)
})
test('connected translation moves an entire room and stretches neighbouring walls without losing openings', () => {
  const plan = furnished(), result = transformRoom(plan, plan.rooms[0].id, 1, 0, { mode: 'connected' })
  assert.equal(result.rooms.length, 2)
  assert.equal(result.openings.length, plan.openings.length)
  assert.equal(result.furniture[0].x, 4.5)
  assert.equal(roomArea(result.rooms.find(r => r.id === plan.rooms[0].id)), 14)
  assert.equal(roomArea(result.rooms.find(r => r.id === plan.rooms[1].id)), 6)
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 2.5, 0, { mode: 'connected' }))
})
test('overlapping copies and movements, invalid displacements and opening cuts are refused', () => {
  const plan = furnished()
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 1, 0, { duplicate: true }), /solapa/)
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 1, 0), /solapa/)
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, NaN, 0))
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 0, 0))
  plan.openings[2].offset = 3
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 10, 0), /atraviesa/)
})
test('locked geometry blocks direct and indirect edits, but permits unlocking and keeps metadata through reconciliation', () => {
  const plan = furnished(); plan.rooms[1].locked = true
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 1, 0, { mode: 'connected' }), /bloqueado/)
  plan.rooms[1].locked = false; plan.walls[1].locked = true
  const changed = structuredClone(plan); changed.walls[1].b.x += 1
  assert.match(lockedChangeError(plan, changed), /bloqueado/)
  const unlocked = structuredClone(plan); unlocked.walls[1].locked = false
  assert.equal(lockedChangeError(plan, unlocked), '')
  plan.rooms[0].locked = true
  assert.equal(reconcilePlan(plan).rooms[0].locked, true)
  assert.throws(() => transformRoom(plan, plan.rooms[0].id, 10, 0), /Desbloquea/)
  const withOpening = furnished(); withOpening.openings[1].locked = true
  assert.throws(() => transformRoom(withOpening, withOpening.rooms[0].id, 1, 0, { mode: 'connected' }), /Desbloquea/)
})
test('interior dimensions subtract both half thicknesses and furniture warnings include rotated wall collisions', () => {
  const plan = furnished(), dimensions = roomInteriorDimensions(plan, plan.rooms[0])
  assert.deepEqual(dimensions.map(d => Number(d.length.toFixed(2))), [3.35, 3.85, 3.35, 3.85])
  assert.deepEqual(furnitureWarnings(plan, plan.furniture[0]), [])
  assert.ok(furnitureWarnings(plan, { ...plan.furniture[0], x: 2, rotation: 45 }).some(s => s.includes('pared')))
  assert.ok(furnitureWarnings(plan, { ...plan.furniture[0], x: 30 }).some(s => s.includes('sobresale')))
  const saved = JSON.parse(JSON.stringify(plan)); assert.equal(validatePlan(saved), true)
  saved.furniture[0].rotation = NaN; assert.equal(validatePlan(saved), false)
  saved.furniture[0].rotation = 0; saved.furniture[0].id = plan.walls[0].id; assert.equal(validatePlan(saved), false)
})
test('double doors split movable width after fixed panels, while sliding keeps one panel', () => {
  const opening = { type: 'door', width: 1.8, offset: 1, fixedSide: 'left', fixedWidth: 0.3, doorType: 'double', flip: true }
  const { leaves } = openingParts(opening)
  assert.equal(leaves.length, 2); assert.equal(leaves[0].width, 0.75); assert.equal(leaves[1].hinge, 'right')
  assert.equal(leaves[0].offset, 1.3); assert.equal(leaves[1].offset, 2.05)
  assert.equal(openingParts({ ...opening, doorType: 'sliding' }).leaves.length, 1)
})
test('3D wall volumes leave openings with correct sill and lintel, including legacy height defaults', () => {
  const wall = { id: 'wall', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.2, height: 3 }
  const opening = { wallId: 'wall', type: 'window', offset: 1, width: 1.5, sill: 1, height: 1.2 }
  const sections = wallSolidSections(wall, [opening])
  const volume = sections.reduce((sum, s) => sum + s.width * s.height * wall.thickness, 0)
  assert.ok(Math.abs(volume - (4 * 3 - 1.5 * 1.2) * 0.2) < 1e-8)
  assert.deepEqual(openingElevation({ type: 'door' }, wall), { sill: 0, height: 2.1 })
  const plan = examplePlan(); plan.openings[2].height = 3
  assert.equal(validatePlan(plan), false)
})
test('3D scene contains real meshes and all mounted geometries/materials are disposed', () => {
  const plan = furnished(); plan.openings[0].doorType = 'double'; plan.openings[2].windowType = 'casement'; plan.openings[2].windowLeaves = 2
  const model = buildPlanScene(THREE, plan, { cutaway: true }), geometries = new Set(), materials = new Set()
  model.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) materials.add(node.material) })
  assert.ok(geometries.size > 20); assert.ok([...materials].some(m => m.clippingPlanes.length))
  let geometryCount = 0, materialCount = 0
  geometries.forEach(g => g.addEventListener('dispose', () => geometryCount++)); materials.forEach(m => m.addEventListener('dispose', () => materialCount++))
  disposeScene(model)
  assert.equal(geometryCount, geometries.size); assert.equal(materialCount, materials.size)
})
