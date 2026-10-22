import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as geometry from '../src/utils/floorPlan.js'

test('wall dimensions can fix A, B or the center while preserving connected rooms', () => {
  for (const fixed of ['start', 'end', 'center']) {
    const plan = geometry.examplePlan(), wall = plan.walls[0]
    const result = geometry.resizeWall(plan, wall.id, { length: 7, thickness: 0.2, height: 2.8, fixed })
    const changed = result.walls[0]
    assert.equal(geometry.distance(changed.a, changed.b), 7)
    assert.equal(changed.thickness, 0.2); assert.equal(changed.height, 2.8)
    if (fixed === 'start') assert.deepEqual(changed.a, wall.a)
    if (fixed === 'end') assert.deepEqual(changed.b, wall.b)
    if (fixed === 'center') assert.equal((changed.a.x + changed.b.x) / 2, (wall.a.x + wall.b.x) / 2)
    assert.equal(result.rooms.length, 2)
    assert.deepEqual(result.rooms.map(r => r.name), plan.rooms.map(r => r.name))
    assert.equal(geometry.projectToWall(result.walls[4].a, changed).distance < 1e-6, true)
    assert.equal(geometry.validatePlan(result), true)
  }
})
test('resizing refuses missing walls, invalid dimensions and openings that no longer fit', () => {
  const plan = geometry.examplePlan(), id = plan.walls[0].id
  const values = { length: 6, thickness: 0.15, height: 2.5 }
  assert.throws(() => geometry.resizeWall(plan, 'missing', values))
  assert.throws(() => geometry.resizeWall(plan, id, { ...values, length: 0 }))
  assert.throws(() => geometry.resizeWall(plan, id, { ...values, thickness: NaN }))
  assert.throws(() => geometry.resizeWall(plan, id, { ...values, length: 2 }), /puerta o ventana/)
  assert.equal(geometry.distance(plan.walls[0].a, plan.walls[0].b), 6, 'failure leaves the original drawing untouched')
})
test('a door has four independent, geometrically distinct hinge and swing combinations', () => {
  const configurations = []
  for (const hinge of ['left', 'right']) for (const flip of [false, true]) {
    const leaf = geometry.openingLeaf({ offset: 1, width: 0.8, hinge, flip })
    assert.equal(leaf.hinge, hinge === 'left' ? 1 : 1.8)
    assert.equal(Math.sign(leaf.y), flip ? -1 : 1)
    assert.ok(Math.abs(Math.hypot(leaf.x - leaf.hinge, leaf.y) - 0.8) < 1e-8)
    configurations.push(leaf.arc)
  }
  assert.equal(new Set(configurations).size, 4)
})
test('old plans remain valid and the new opening properties survive save/export JSON', () => {
  const plan = geometry.examplePlan()
  assert.equal(geometry.validatePlan(plan), true)
  plan.openings[0].hinge = 'right'
  plan.openings[2].windowType = 'casement'; plan.openings[2].hinge = 'right'; plan.openings[2].flip = true
  assert.equal(geometry.validatePlan(plan), true)
  const saved = geometry.reconcilePlan(JSON.parse(JSON.stringify(plan)))
  assert.equal(saved.openings[0].hinge, 'right')
  assert.equal(saved.openings[2].windowType, 'casement')
  saved.openings[2].windowType = 'invalid'
  assert.equal(geometry.validatePlan(saved), false)
})

const source = await readFile(new URL('../src/components/floorplan/PlanDrawing.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsxFactory: 'element', jsxFragment: 'Fragment' })
function renderOpening(opening) {
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, Fragment: 'fragment', require: () => geometry, element: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }) })
  const tree = module.exports.default({ plan: { walls: [{ id: 'wall', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness: 0.15 }], rooms: [], openings: [{ id: 'opening', wallId: 'wall', offset: 1, width: 1.2, ...opening }] } })
  const all = node => !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(all)]
  return all(tree)
}
test('sliding and casement windows produce different plan symbols', () => {
  const sliding = renderOpening({ type: 'window', windowType: 'sliding' })
  const casement = renderOpening({ type: 'window', windowType: 'casement', hinge: 'right' })
  assert.equal(sliding.some(node => node.type === 'title' && node.children.join('').includes('corredera')), true)
  assert.equal(casement.some(node => node.type === 'title' && node.children.join('').includes('abatible')), true)
  assert.equal(sliding.some(node => node.props.strokeDasharray === '.06 .04'), false)
  assert.equal(casement.some(node => node.props.strokeDasharray === '.06 .04'), true)
})
test('the drawn door arc uses the chosen hinge as well as the swing direction', () => {
  const paths = []
  for (const hinge of ['left', 'right']) for (const flip of [false, true]) {
    const nodes = renderOpening({ type: 'door', hinge, flip })
    paths.push(nodes.find(node => node.type === 'path' && node.props.d.includes(' A ')).props.d)
  }
  assert.equal(new Set(paths).size, 4)
})
