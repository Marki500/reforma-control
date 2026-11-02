import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { wallCornerJoins, buildPlanScene, disposeScene } from '../src/utils/plan3d.js'

const wall = (id, a, b, thickness = 0.2, height = 2.5) => ({ id, a, b, thickness, height })
const planOf = walls => ({ version: 1, walls, rooms: [], openings: [] })
const rotate = (point, angle) => ({ x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)

test('right-angle corners close the missing outside quadrant at every orientation', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 5]) {
    const origin = { x: 0, y: 0 }
    const plan = planOf([wall('a', origin, rotate({ x: 3, y: 0 }, angle)), wall('b', origin, rotate({ x: 0, y: 3 }, angle))])
    assert.equal(wallCornerJoins(plan).length, 1)
    const scene = buildPlanScene(THREE, plan)
    try {
      scene.updateMatrixWorld(true)
      const point = rotate({ x: -0.05, y: -0.05 }, angle)
      const ray = new THREE.Raycaster(new THREE.Vector3(point.x, 10, point.y), new THREE.Vector3(0, -1, 0))
      const hits = ray.intersectObject(scene, true)
      assert.ok(hits.some(hit => hit.object.userData.wallCornerJoin), 'the former corner gap contains solid wall geometry')
      near(hits[0].point.y, 2.5)
    } finally { disposeScene(scene) }
  }
})

test('different wall thicknesses meet at the intersection of their outside faces', () => {
  const plan = planOf([wall('a', { x: 0, y: 0 }, { x: 3, y: 0 }, 0.4), wall('b', { x: 0, y: 0 }, { x: 0, y: 3 }, 0.2)])
  const [join] = wallCornerJoins(plan)
  assert.ok(join.points.some(point => Math.abs(point.x + 0.1) < 1e-6 && Math.abs(point.y + 0.2) < 1e-6))
  assert.equal(join.bevel, false)
})

test('sharp corners use bounded bevels instead of long spikes', () => {
  const plan = planOf([wall('a', { x: 0, y: 0 }, { x: 3, y: 0 }), wall('b', { x: 0, y: 0 }, rotate({ x: 3, y: 0 }, Math.PI / 180))])
  const [join] = wallCornerJoins(plan)
  assert.equal(join.bevel, true)
  assert.ok(join.points.every(point => Math.hypot(point.x, point.y) <= 0.4))
})

test('straight joins, T and X intersections do not receive protruding corner fillers', () => {
  const host = wall('a', { x: -3, y: 0 }, { x: 3, y: 0 })
  assert.equal(wallCornerJoins(planOf([host, wall('b', { x: 0, y: 0 }, { x: 0, y: 3 })])).length, 0)
  assert.equal(wallCornerJoins(planOf([host, wall('b', { x: 0, y: -3 }, { x: 0, y: 3 })])).length, 0)
  assert.equal(wallCornerJoins(planOf([wall('a', { x: -3, y: 0 }, { x: 0, y: 0 }), wall('b', { x: 0, y: 0 }, { x: 3, y: 0 })])).length, 0)
})

test('corner heights respect adjoining walls and cutaway, without changing saved geometry', () => {
  const plan = planOf([wall('a', { x: 0, y: 0 }, { x: 3, y: 0 }, 0.2, 3), wall('b', { x: 0, y: 0 }, { x: 0, y: 3 }, 0.2, 2)])
  const before = structuredClone(plan)
  for (const cutaway of [false, true]) {
    const scene = buildPlanScene(THREE, plan, { cutaway })
    try {
      const mesh = scene.children.find(child => child.userData.wallCornerJoin)
      const bounds = new THREE.Box3().setFromObject(mesh)
      near(bounds.min.y, 0)
      near(bounds.max.y, cutaway ? 1 : 2)
    } finally { disposeScene(scene) }
  }
  assert.deepEqual(plan, before)
})
