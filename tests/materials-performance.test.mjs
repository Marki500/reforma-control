import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Exercise the real page's handlers with deterministic hooks and data services.
// No browser, credentials or real records are involved.
test('materials page limits rendering, searches all items and updates without a full reload', async () => {
  const h = globalThis.__materialsTest = {
    slots: [], cursor: 0, effects: [], reads: 0, writes: 0,
    data: Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, name: `Material ${i}`, price: 10, quantity: 1, count_in_total: true, status: 'Mirando' })),
  }
  h.data[0].status = 'Favorito'
  h.data[0].main_image_url = 'https://shop.example/one.jpg'
  h.data[1].main_image_url = 'https://shop.example/two.jpg'
  h.sources = []; h.optimized = []; h.statusWrites = []
  const hooks = `
    const h = globalThis.__materialsTest;
    export function useState(initial) {
      const i = h.cursor++;
      if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value }];
    }
    const changed = (a, b) => !a || a.some((v, i) => !Object.is(v, b[i]));
    export function useMemo(fn, deps) {
      const i = h.cursor++;
      if (!h.slots[i] || changed(h.slots[i].deps, deps)) h.slots[i] = { deps, value: fn() };
      return h.slots[i].value;
    }
    export const useRef = initial => useState({ current: initial })[0];
    export const useCallback = (fn, deps) => useMemo(() => fn, deps);
    export function useEffect(fn, deps) {
      const i = h.cursor++;
      if (changed(h.slots[i], deps)) { h.slots[i] = deps; h.effects.push(fn) }
    }
    export const useDeferredValue = value => value;
  `
  const services = `
    const h = globalThis.__materialsTest;
    export async function getCategories() { h.reads++; return [] }
    export async function getRooms() { h.reads++; return [] }
    export async function getCurrentProjectId() { return 'project' }
    export async function updateMaterialStatus(id, status, expected) {
      h.statusWrites.push({ id, status, expected });
      if (h.statusFailure) throw new Error('No permission to update');
      if (h.pendingStatus) await h.pendingStatus;
      return { id, status };
    }
    export async function updateMaterial(id, data) { h.writes++; return { ...data, id, rooms: { name: 'Kitchen' }, material_categories: { name: 'Floor' } } }
    export async function createMaterial(data) { h.writes++; return { ...data, id: 'new' } }
    export async function deleteMaterial() { h.writes++ }
    export async function toggleCountInTotal() { h.writes++ }
    const localImage = 'https://api-reforma.noxumlab.com/storage/v1/object/public/material-images/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/optimized/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp';
    export async function optimizeSavedMaterialImage(id) {
      h.optimized.push(id);
      if (id === 'm1') throw new Error('Shop blocked');
      return { material: { id, main_image_url: localImage } };
    }
    export async function uploadImage(source) { h.sources.push(source); return localImage }
    export async function removeStoredFile() {}
    export const supabase = { from() { return { select() { return this }, order() { h.reads++; return Promise.resolve({ data: h.data }) } } } };
  `
  const { outputFiles } = await build({
    entryPoints: ['src/pages/Materials.jsx'], bundle: true, write: false,
    platform: 'node', format: 'esm', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'materials-fixture', setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'fixture' }))
      b.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'fixture' }))
      b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'fixture' }))
      b.onResolve({ filter: /services\// }, () => ({ path: 'services', namespace: 'fixture' }))
      b.onResolve({ filter: /components\// }, () => ({ path: 'components', namespace: 'fixture' }))
      b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'icons', namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
        hooks, services,
        jsx: 'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;',
        router: 'const params = new URLSearchParams(); export const useSearchParams = () => [params, () => {}];',
        components: 'export default function Component() {} export function Button() {} export function Modal() {}',
        icons: 'export const Package=0, LayoutGrid=0, Table2=0, Plus=0, ExternalLink=0, Search=0;',
      }[path] }))
    } }],
  })
  try {
    const { default: Materials } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
    const render = () => { h.cursor = 0; return Materials() }
    const settle = async () => { for (const effect of h.effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)) }
    const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
    const cards = tree => nodes(tree).filter(node => node.props?.material)
    const find = (tree, predicate) => { const node = nodes(tree).find(predicate); assert.ok(node, 'Expected page control'); return node.props }
    let tree = render(); await settle(); tree = render(); await settle(); tree = render()
    assert.equal(h.reads, 3)
    assert.equal(cards(tree).length, 24)
    assert.match(JSON.stringify(tree), /300,00/)
    const statusButton = (tree, label) => find(tree, n => n.type === 'button' && n.props?.children?.[0] === label)
    const statusCount = (tree, label) => statusButton(tree, label).children[1].props.children
    assert.equal(statusCount(tree, 'Todos'), 30)
    assert.equal(statusCount(tree, 'Comprados'), 0)
    assert.equal(statusCount(tree, 'Recibidos'), 0)
    statusButton(tree, 'Recibidos').onClick()
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 0)
    assert.equal(statusButton(tree, 'Recibidos')['aria-pressed'], true)
    assert.match(JSON.stringify(tree), /No se encontraron materiales con estos filtros/)
    statusButton(tree, 'Todos').onClick()
    tree = render(); await settle(); tree = render()
    // Direct purchase changes only status; undo restores the exact old value.
    const first = cards(tree)[0].props
    await first.onPurchase(first.material)
    tree = render()
    assert.equal(cards(tree)[0].props.material.status, 'Comprado')
    assert.equal(statusCount(tree, 'Comprados'), 1)
    statusButton(tree, 'Comprados').onClick()
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 1)
    assert.equal(cards(tree)[0].props.material.id, 'm0')
    assert.equal(find(tree, n => n.props?.filters && n.props?.onChange).filters.status, 'Comprado')
    assert.equal(statusCount(tree, 'Todos'), 30, 'Counts must ignore the selected status')
    statusButton(tree, 'Todos').onClick()
    tree = render(); await settle(); tree = render()
    assert.deepEqual(h.statusWrites[0], { id: 'm0', status: 'Comprado', expected: 'Favorito' })
    assert.match(JSON.stringify(tree), /300,00/)
    assert.equal(cards(tree)[0].props.material.price, 10)
    await find(tree, n => n.props?.children === 'Deshacer').onClick()
    tree = render()
    assert.equal(cards(tree)[0].props.material.status, 'Favorito')
    // A failed write leaves the product unchanged and reports the failure.
    h.statusFailure = true
    await cards(tree)[0].props.onPurchase(cards(tree)[0].props.material)
    tree = render()
    assert.equal(cards(tree)[0].props.material.status, 'Favorito')
    assert.match(JSON.stringify(tree), /No permission to update/)
    h.statusFailure = false
    let release
    h.pendingStatus = new Promise(resolve => { release = resolve })
    const before = h.statusWrites.length
    const handler = cards(tree)[0].props.onPurchase
    const request = handler(cards(tree)[0].props.material)
    await handler(cards(tree)[0].props.material)
    tree = render()
    assert.equal(cards(tree)[0].props.purchasePending, true)
    assert.equal(h.statusWrites.length, before + 1, 'Double click must make only one request')
    release(); await request; h.pendingStatus = null
    tree = render()
    await find(tree, n => n.props?.children === 'Deshacer').onClick()
    tree = render()
    assert.equal(cards(tree)[0].props.material.status, 'Favorito')
    assert.equal(h.reads, 3, 'Purchase and undo must not reload the catalog')
    find(tree, n => n.props?.filters && n.props?.onChange).onChange({ category_id: '', room_id: '', priority: '', status: 'Favorito' })
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 1)
    await cards(tree)[0].props.onPurchase(cards(tree)[0].props.material)
    tree = render()
    assert.equal(cards(tree).length, 0, 'Status filter updates immediately after purchase')
    await find(tree, n => n.props?.children === 'Deshacer').onClick()
    tree = render()
    assert.equal(cards(tree).length, 1, 'Undo is available even after filtering removes the card')
    find(tree, n => n.props?.filters && n.props?.onChange).onChange({ category_id: '', room_id: '', priority: '', status: '' })
    tree = render(); await settle(); tree = render()
    find(tree, n => n.props?.['aria-label'] === 'Vista de tabla').onClick()
    tree = render()
    assert.equal(typeof find(tree, n => n.props?.materials).onPurchase, 'function')
    find(tree, n => n.props?.['aria-label'] === 'Vista de tarjetas').onClick()
    tree = render()
    await find(tree, n => n.props?.children?.[0]?.startsWith?.('Optimizar')).onClick()
    tree = render()
    assert.deepEqual(h.optimized, ['m0', 'm1'])
    assert.match(cards(tree)[0].props.material.main_image_url, /optimized/)
    assert.equal(cards(tree)[1].props.material.main_image_url, 'https://shop.example/two.jpg')
    assert.equal(cards(tree)[0].props.material.price, 10)
    assert.match(JSON.stringify(tree), /No se pudieron optimizar 1/)
    assert.match(JSON.stringify(tree), /Shop blocked/)
    const collect = find(tree, n => typeof n.props?.collect === 'function').collect
    const report = collect()
    assert.equal(report.optimization_failures[0].material, 'Material 1')
    assert.equal(report.optimization_failures[0].reason, 'Shop blocked')
    assert.equal(typeof report.load.materials_ms, 'number')
    tree.props.onErrorCapture({ type: 'error', target: { tagName: 'IMG', src: 'https://shop.example/photo?secret=value', alt: 'Failed photo' } })
    const imageReport = collect()
    assert.equal(imageReport.image_errors[0].name, 'Failed photo')
    assert.equal(JSON.stringify(imageReport).includes('secret=value'), false)
    assert.equal(h.reads, 3)
    find(tree, n => n.props?.children === 'Siguiente').onClick()
    tree = render()
    assert.equal(cards(tree).length, 6)
    // Quick filters reset pagination and preserve the other filters and search.
    statusButton(tree, 'Todos').onClick()
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 24)
    // Searching still reaches records beyond the first batch.
    find(tree, n => n.type === 'input' && n.props.type === 'search').onChange({ target: { value: 'Material 29' } })
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 1)
    assert.equal(cards(tree)[0].props.material.id, 'm29')
    assert.equal(statusCount(tree, 'Todos'), 1, 'Counts reflect the current search')
    statusButton(tree, 'Comprados').onClick()
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 0)
    assert.equal(find(tree, n => n.type === 'input' && n.props.type === 'search').value, 'Material 29')
    statusButton(tree, 'Todos').onClick()
    tree = render(); await settle(); tree = render()
    assert.equal(h.reads, 3, 'Quick filters must not query the server')
    cards(tree)[0].props.onEdit(cards(tree)[0].props.material)
    tree = render()
    await find(tree, n => n.props?.onSave).onSave({ name: 'Material 29 updated', price: 20, quantity: 1 }, null)
    tree = render()
    assert.equal(h.reads, 3, 'Saving must not download the entire catalog again')
    assert.equal(cards(tree)[0].props.material.rooms.name, 'Kitchen')
    assert.equal(cards(tree)[0].props.material.price, 20)
    cards(tree)[0].props.onDelete(cards(tree)[0].props.material)
    tree = render()
    await find(tree, n => n.props?.onConfirm).onConfirm()
    tree = render()
    assert.equal(h.reads, 3, 'Deleting must not download the entire catalog again')
    assert.equal(cards(tree).length, 0)
    assert.equal(h.writes, 2)
    // Creating a material also updates the local catalog and complete total.
    find(tree, n => n.type === 'input' && n.props.type === 'search').onChange({ target: { value: '' } })
    tree = render(); await settle(); tree = render()
    find(tree, n => n.props?.title === 'Nuevo material' || n.props?.title === 'Editar material').onClose()
    tree = render()
    await find(tree, n => n.props?.onSave).onSave({ name: 'New tile', price: 30, quantity: 1 }, null)
    tree = render()
    assert.equal(cards(tree)[0].props.material.id, 'new')
    assert.match(JSON.stringify(tree), /320,00/)
    assert.equal(h.reads, 3)
    await find(tree, n => n.props?.onSave).onSave({ name: 'Remote photo', price: 30, quantity: 1, main_image_url: 'https://shop.example/new.jpg' }, null)
    tree = render()
    assert.equal(h.sources[0], 'https://shop.example/new.jpg')
    assert.match(cards(tree)[0].props.material.main_image_url, /optimized/)
    const photo = { size: 1000 }
    await find(tree, n => n.props?.onSave).onSave({ name: 'Uploaded photo', price: 30, quantity: 1 }, photo)
    tree = render()
    assert.equal(h.sources[1], photo)
    assert.match(cards(tree)[0].props.material.main_image_url, /optimized/)
    assert.equal(h.reads, 3)
  } finally { delete globalThis.__materialsTest }
})
