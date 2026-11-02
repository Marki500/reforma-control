import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as geometry from '../src/utils/floorPlan.js'
import * as navigation from '../src/utils/planNavigation.js'
import * as editing from '../src/utils/planEditing.js'
import * as furniture from '../src/utils/planFurniture.js'

// Execute the actual component handlers with a minimal hook/element runtime.
// No DOM, browser, provider or duplicate implementation of the gesture logic.
const source = await readFile(new URL('../src/components/floorplan/FloorPlanEditor.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsxFactory: 'element', jsxFragment: 'Fragment' })
function editor(planData = geometry.examplePlan()) {
  const hooks = [], frames = new Map(), captured = new Set()
  let hookIndex = 0, frameId = 0, tree
  const drawing = () => null
  const matrix = { a: 50, b: 0, inverse: () => ({ scale: 1 / 50 }) }
  const svg = { focus() {}, getScreenCTM: () => matrix, setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id) }
  const react = {
    useEffect() {}, useMemo: fn => fn(),
    useRef(value) { const index = hookIndex++; return hooks[index] ||= { current: value } },
    useState(value) {
      const index = hookIndex++
      if (!(index in hooks)) hooks[index] = typeof value === 'function' ? value() : value
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next }]
    },
  }
  const module = { exports: {} }
  runInNewContext(code, {
    module, exports: module.exports, crypto, Fragment: 'fragment',
    element: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    sessionStorage: { getItem: () => null },
    DOMPoint: class { constructor(x, y) { this.x = x; this.y = y } matrixTransform(m) { return { x: this.x * m.scale, y: this.y * m.scale } } },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId }, cancelAnimationFrame: id => frames.delete(id),
    require: name => name === 'react' ? react : name.includes('utils/floorPlan') ? geometry : name.includes('utils/planNavigation') ? navigation : name.includes('utils/planEditing') ? editing : name.includes('utils/planFurniture') ? furniture : name.endsWith('/PlanDrawing') ? { default: drawing, __esModule: true } : new Proxy({}, { get: () => () => null }),
  })
  const props = { plan: { id: 'test', name: 'Test', plan_data: planData }, rooms: [], canEdit: true, draftKey: 'test' }
  function all(node = tree) { return !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(child => all(child))] }
  function render() {
    hookIndex = 0; tree = module.exports.default(props)
    all().find(node => node.type === 'svg').props.ref.current = svg
  }
  render()
  function canvas() { return all().find(node => node.type === 'svg') }
  function flush() { for (const [id, fn] of frames) { frames.delete(id); fn() }; render() }
  function event(id, x, y, extra = {}) {
    return { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, target: { closest: () => null }, preventDefault() {}, stopPropagation() { this.stopped = true }, ...extra }
  }
  return {
    tool(label) { all().find(node => node.type === 'button' && node.children.includes(label)).props.onClick(); render() },
    down(e) { canvas().props.onPointerDownCapture(e); if (!e.stopped) canvas().props.onPointerDown(e); render() },
    move(e) { canvas().props.onPointerMove(e); flush() },
    up(e, cancel = false) { (cancel ? canvas().props.onPointerCancel : canvas().props.onPointerUp)(e); flush() },
    event,
    click(label) { all().find(node => node.type === 'button' && node.props['aria-label'] === label).props.onClick(); render() },
    key(key, extra = {}) { const e = { key, target: { tagName: 'svg' }, preventDefault() { this.prevented = true }, ...extra }; tree.props.onKeyDown(e); render(); return e },
    pressed: label => all().find(node => node.type === 'button' && node.children.includes(label))?.props['aria-pressed'],
    elementDown(e, target) { all().find(node => node.type === drawing).props.onSelect(e, target); render() },
    anchor: () => all().find(node => node.type === 'circle' && node.props.r === '0.08')?.props,
    plan: () => all().find(node => node.type === drawing).props.plan,
    view: () => canvas().props.viewBox,
    tracing: () => all().some(node => node.type === 'button' && node.children.includes('Terminar trazo')),
    undoable: () => !all().find(node => node.type === 'button' && node.props['aria-label'] === 'Deshacer').props.disabled,
  }
}

test('Ctrl navigation is captured before drawing and preserves the active wall tool', () => {
  const ui = editor(); ui.tool('Pared')
  const before = structuredClone(ui.plan()), view = ui.view()
  ui.down(ui.event(1, 300, 100, { pointerType: 'mouse', ctrlKey: true }))
  ui.move(ui.event(1, 360, 140, { pointerType: 'mouse', ctrlKey: true }))
  ui.up(ui.event(1, 360, 140, { pointerType: 'mouse' }))
  assert.deepEqual(ui.plan(), before); assert.notEqual(ui.view(), view)
  assert.equal(ui.tracing(), false); assert.equal(ui.undoable(), false)
  ui.down(ui.event(2, 320, 100, { pointerType: 'mouse' }))
  assert.equal(ui.tracing(), true, 'drawing still works after releasing Ctrl')
})
test('two fingers pan and pinch without placing a wall, including after the first finger lifts', () => {
  const ui = editor(); ui.tool('Pared')
  const before = structuredClone(ui.plan()), view = ui.view()
  ui.down(ui.event(1, 200, 100))
  assert.equal(ui.tracing(), false, 'first touch waits for a tap or another finger')
  ui.down(ui.event(2, 350, 100)); ui.move(ui.event(2, 430, 150))
  assert.notEqual(ui.view(), view)
  ui.up(ui.event(1, 200, 100)); ui.move(ui.event(2, 450, 170)); ui.up(ui.event(2, 450, 170))
  assert.deepEqual(ui.plan(), before); assert.equal(ui.tracing(), false); assert.equal(ui.undoable(), false)
})
test('adding a second finger rolls back an object drag rather than committing an accidental wall move', () => {
  const ui = editor(), before = structuredClone(ui.plan()), wallId = before.walls[0].id
  const target = { closest: () => ({ dataset: { planKind: 'wall', planId: wallId } }) }
  ui.down(ui.event(1, 300, 100, { target })); ui.move(ui.event(1, 300, 125))
  assert.notDeepEqual(ui.plan().walls, before.walls)
  ui.down(ui.event(2, 400, 150))
  assert.deepEqual(ui.plan(), before)
  ui.up(ui.event(1, 300, 125)); ui.up(ui.event(2, 400, 150))
  assert.equal(ui.undoable(), false)
})
test('a single finger can start and end a partition exactly on existing walls', () => {
  const ui = editor(); ui.tool('Pared')
  ui.down(ui.event(1, 320, 100)); ui.up(ui.event(1, 320, 100))
  assert.equal(ui.tracing(), true)
  ui.down(ui.event(2, 320, 300)); ui.up(ui.event(2, 320, 300))
  assert.equal(ui.plan().walls.length, 6); assert.equal(ui.plan().rooms.length, 3)
  const added = ui.plan().walls.at(-1)
  assert.deepEqual(added.a, { x: 6.4, y: 2 }); assert.deepEqual(added.b, { x: 6.4, y: 6 })
})
test('a cancelled or sliding first touch never becomes a drawing tap', () => {
  const ui = editor(); ui.tool('Pared')
  ui.down(ui.event(1, 320, 100)); ui.up(ui.event(1, 320, 100), true)
  assert.equal(ui.tracing(), false)
  ui.down(ui.event(2, 320, 100)); ui.move(ui.event(2, 340, 130)); ui.up(ui.event(2, 340, 130))
  assert.equal(ui.tracing(), false); assert.equal(ui.plan().walls.length, 5)
})


test('centimetre precision affects drawing without changing the default ten-centimetre grid', () => {
  for (const precise of [false, true]) {
    const ui = editor(geometry.emptyPlan()); ui.tool('Pared')
    if (precise) ui.click('Ajuste de precisión')
    ui.down(ui.event(1, 1011.5, 1011.5, { pointerType: 'mouse' }))
    ui.down(ui.event(2, 1063.5, 1011.5, { pointerType: 'mouse' }))
    const wall = ui.plan().walls[0]
    assert.ok(Math.abs(wall.a.x - (precise ? 20.23 : 20.2)) < 1e-8)
    assert.ok(Math.abs(wall.b.x - (precise ? 21.27 : 21.3)) < 1e-8)
  }
})

test('tool shortcuts do not intercept typing into measurement fields', () => {
  const ui = editor()
  assert.equal(ui.key('p').prevented, true)
  assert.equal(ui.pressed('Pared'), true)
  ui.key('v', { target: { tagName: 'INPUT' } })
  assert.equal(ui.pressed('Pared'), true)
  ui.key('v')
  assert.equal(ui.pressed('Seleccionar'), true)
})

test('a small mouse tremor selects without moving geometry or creating undo history', () => {
  const ui = editor(), before = structuredClone(ui.plan())
  ui.elementDown(ui.event(1, 100, 100, { pointerType: 'mouse' }), { kind: 'wall', id: before.walls[0].id })
  ui.move(ui.event(1, 102, 101, { pointerType: 'mouse' }))
  ui.up(ui.event(1, 102, 101, { pointerType: 'mouse' }))
  assert.deepEqual(ui.plan(), before)
  assert.equal(ui.undoable(), false)
})

test('a rejected wall crossing leaves the tracing origin at its last valid position', () => {
  let plan = geometry.emptyPlan()
  const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]
  for (let i = 0; i < 4; i++) plan = geometry.addWall(plan, points[i], points[(i + 1) % 4])
  plan = geometry.reconcilePlan(plan)
  plan.rooms[0].locked = true
  const ui = editor(plan), before = structuredClone(ui.plan()); ui.tool('Pared')
  ui.down(ui.event(1, 100, 0, { pointerType: 'mouse' }))
  ui.down(ui.event(2, 100, 200, { pointerType: 'mouse' }))
  assert.deepEqual(ui.plan(), before)
  assert.equal(ui.anchor().cx, 2)
  assert.equal(ui.anchor().cy, 0)
  assert.equal(ui.undoable(), false)
})


test('dragging a junction moves every connected branch and one undo restores the original', () => {
  const plan = geometry.reconcilePlan(geometry.addWall(geometry.addWall(geometry.emptyPlan(), { x: 0, y: 0 }, { x: 6, y: 0 }), { x: 3, y: 0 }, { x: 3, y: 3 }))
  const ui = editor(plan), before = structuredClone(ui.plan()), junction = editing.planJunctions(plan)[0]
  ui.elementDown(ui.event(1, 150, 0, { pointerType: 'mouse' }), { ...junction, kind: 'junction' })
  ui.move(ui.event(1, 175, 25, { pointerType: 'mouse' }))
  ui.up(ui.event(1, 175, 25, { pointerType: 'mouse' }))
  const moved = { x: 3.5, y: 0.5 }
  assert.equal(ui.plan().walls.length, 3)
  assert.equal(ui.plan().walls.filter(wall => geometry.samePoint(wall.a, moved) || geometry.samePoint(wall.b, moved)).length, 3)
  assert.equal(ui.undoable(), true)
  ui.key('z', { ctrlKey: true })
  assert.deepEqual(ui.plan(), before)
})

test('touch can drag a junction and cancellation restores the unsplit host', () => {
  const plan = geometry.reconcilePlan(geometry.addWall(geometry.addWall(geometry.emptyPlan(), { x: 0, y: 0 }, { x: 6, y: 0 }), { x: 3, y: 0 }, { x: 3, y: 3 }))
  const ui = editor(plan), before = structuredClone(ui.plan()), junction = editing.planJunctions(plan)[0]
  const target = { closest: () => ({ dataset: { planKind: 'junction', planId: junction.id } }) }
  ui.down(ui.event(1, 150, 0, { target }))
  ui.move(ui.event(1, 175, 25))
  assert.equal(ui.plan().walls.length, 3)
  ui.up(ui.event(1, 175, 25), true)
  assert.deepEqual(ui.plan(), before)
  assert.equal(ui.undoable(), false)
})
