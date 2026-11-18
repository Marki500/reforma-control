import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Exercise the real page's handlers with deterministic hooks and data services.
// No browser, credentials or real records are involved.
test('materials page limits rendering, searches all items and updates without a full reload', async () => {
  const h = globalThis.__materialsTest = {
    slots: [], cursor: 0, effects: [], reads: 0, writes: 0,
    data: Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, name: `Material ${i}`, price: 10, quantity: 1, count_in_total: true })),
  }
  h.data[0].main_image_url = 'https://shop.example/one.jpg'
  h.data[1].main_image_url = 'https://shop.example/two.jpg'
  h.sources = []; h.optimized = []
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
    await find(tree, n => n.props?.children?.[0]?.startsWith?.('Optimizar')).onClick()
    tree = render()
    assert.deepEqual(h.optimized, ['m0', 'm1'])
    assert.match(cards(tree)[0].props.material.main_image_url, /optimized/)
    assert.equal(cards(tree)[1].props.material.main_image_url, 'https://shop.example/two.jpg')
    assert.equal(cards(tree)[0].props.material.price, 10)
    assert.match(JSON.stringify(tree), /No se pudieron optimizar 1/)
    assert.equal(h.reads, 3)
    find(tree, n => n.props?.children === 'Siguiente').onClick()
    tree = render()
    assert.equal(cards(tree).length, 6)
    // Searching still reaches records beyond the first batch.
    find(tree, n => n.type === 'input' && n.props.type === 'search').onChange({ target: { value: 'Material 29' } })
    tree = render(); await settle(); tree = render()
    assert.equal(cards(tree).length, 1)
    assert.equal(cards(tree)[0].props.material.id, 'm29')
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
