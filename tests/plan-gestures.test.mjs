import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as geometry from '../src/utils/floorPlan.js'
import * as navigation from '../src/utils/planNavigation.js'

// Execute the actual component handlers with a minimal hook/element runtime.
// No DOM, browser, provider or duplicate implementation of the gesture logic.
const source = await readFile(new URL('../src/components/floorplan/FloorPlanEditor.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsxFactory: 'element', jsxFragment: 'Fragment' })
function editor() {
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
    require: name => name === 'react' ? react : name.includes('utils/floorPlan') ? geometry : name.includes('utils/planNavigation') ? navigation : name.endsWith('/PlanDrawing') ? { default: drawing, __esModule: true } : new Proxy({}, { get: () => () => null }),
  })
  const props = { plan: { id: 'test', name: 'Test', plan_data: geometry.examplePlan() }, rooms: [], canEdit: true, draftKey: 'test' }
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
