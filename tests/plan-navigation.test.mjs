import test from 'node:test'
import assert from 'node:assert/strict'
import { drawingTargets, snapDrawing } from '../src/utils/floorPlan.js'
import { gestureView, touchPair, zoomView } from '../src/utils/planNavigation.js'

const view = { x: 0, y: 0, width: 16, height: 11 }
const wall = (id, a, b) => ({ id, a, b })
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)

test('panning uses continuous movement without snapping navigation to the drawing grid', () => {
  const moved = gestureView(view, { x: 2, y: 3 }, { x: 2.037, y: 3.082 })
  near(moved.x, -0.037); near(moved.y, -0.082)
  assert.equal(moved.width, 16); assert.equal(moved.height, 11)
})
test('zoom preserves the world point under the pointer, with bounds and aspect ratio', () => {
  const anchor = { x: 4, y: 3 }, zoomed = zoomView(view, 0.5, anchor)
  near((anchor.x - view.x) / view.width, (anchor.x - zoomed.x) / zoomed.width)
  near((anchor.y - view.y) / view.height, (anchor.y - zoomed.y) / zoomed.height)
  assert.equal(zoomed.width, 8)
  assert.equal(zoomView(view, 0.0001).width, 3)
  assert.equal(zoomView(view, 1000).width, 120)
})
test('two fingers combine pan and pinch around their moving midpoint', () => {
  const first = touchPair(new Map([[1, { x: 2, y: 3 }], [2, { x: 4, y: 3 }]]))
  const next = touchPair(new Map([[1, { x: 2, y: 4 }], [2, { x: 6, y: 4 }]]))
  const moved = gestureView(view, first.center, next.center, next.distance / first.distance)
  assert.equal(moved.width, 8)
  near((first.center.x - moved.x) / moved.width, (next.center.x - view.x) / view.width)
  near((first.center.y - moved.y) / moved.height, (next.center.y - view.y) / view.height)
})
test('snaps to the closest endpoint, independent of the wall ordering or the grid', () => {
  const walls = [wall('far', { x: 2.2, y: 1.237 }, { x: 8, y: 1.237 }), wall('near', { x: 2.034, y: 1.237 }, { x: 2.034, y: 4 })]
  const result = snapDrawing({ x: 2.06, y: 1.25 }, walls)
  assert.equal(result.type, 'endpoint')
  assert.deepEqual(result.point, { x: 2.034, y: 1.237 })
})
test('recognizes exact crossings and starts at the middle of non-grid walls', () => {
  const walls = [wall('h', { x: 0, y: 1.237 }, { x: 6, y: 1.237 }), wall('v', { x: 2.034, y: 0 }, { x: 2.034, y: 4 })]
  const targets = drawingTargets(walls)
  assert.ok(targets.some(item => item.type === 'intersection'))
  const crossing = snapDrawing({ x: 2.06, y: 1.25 }, walls, null, 0.18, targets)
  assert.equal(crossing.type, 'intersection')
  near(crossing.point.x, 2.034); near(crossing.point.y, 1.237)
  const middle = snapDrawing({ x: 4.53, y: 1.25 }, walls)
  assert.equal(middle.type, 'wall')
  near(middle.point.y, 1.237)
  const junction = drawingTargets([walls[0], wall('partition', { x: 3.034, y: 1.237 }, { x: 3.034, y: 4 })])
  assert.equal(snapDrawing({ x: 3.05, y: 1.25 }, walls, null, 0.18, junction).type, 'intersection')
})
test('closing against a wall keeps horizontal or vertical alignment, including diagonal hosts', () => {
  const walls = [wall('v', { x: 2.034, y: -1 }, { x: 2.034, y: 4 })]
  const result = snapDrawing({ x: 2.08, y: 1.26 }, walls, { x: 0, y: 1.237 })
  near(result.point.x, 2.034); near(result.point.y, 1.237)
  const diagonal = snapDrawing({ x: 3.04, y: 1.98 }, [wall('d', { x: 2, y: 1 }, { x: 4, y: 3 })], { x: 0, y: 2 })
  assert.deepEqual(diagonal.point, { x: 3, y: 2 })
})
test('the magnetic radius can follow screen zoom instead of grabbing remote geometry', () => {
  const walls = [wall('v', { x: 2.034, y: 0 }, { x: 2.034, y: 4 })]
  assert.equal(snapDrawing({ x: 2.08, y: 2 }, walls, null, 0.02).type, 'grid')
  assert.equal(snapDrawing({ x: 2.08, y: 2 }, walls, null, 0.1).type, 'wall')
})
