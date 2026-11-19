import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { load } from 'cheerio'

const bundle = async options => {
  const { outputFiles } = await build({ ...options, bundle: true, write: false, platform: 'node', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
}

test('purchase service updates only status and rejects stale or denied writes', async () => {
  const h = globalThis.__purchaseService = { calls: [], result: { data: { id: 'm1', status: 'Comprado' }, error: null } }
  try {
    const { updateMaterialStatus } = await bundle({ entryPoints: ['src/services/materialsService.js'],
      plugins: [{ name: 'purchase-db', setup(b) {
        b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'db', namespace: 'fixture' }))
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
          const h = globalThis.__purchaseService;
          export const supabase = { from(table) {
            const call = { table, filters: [] }; h.calls.push(call);
            return { update(payload) { call.payload = payload; return this },
              eq(key, value) { call.filters.push(['eq', key, value]); return this },
              is(key, value) { call.filters.push(['is', key, value]); return this },
              select(fields) { call.select = fields; return this },
              maybeSingle: async () => h.result };
          } };
        ` }))
      } }],
    })
    assert.deepEqual(await updateMaterialStatus('m1', 'Comprado', 'Favorito'), { id: 'm1', status: 'Comprado' })
    assert.deepEqual(h.calls[0].payload, { status: 'Comprado' })
    assert.deepEqual(h.calls[0].filters, [['eq', 'id', 'm1'], ['eq', 'status', 'Favorito']])
    await updateMaterialStatus('m1', 'Favorito', 'Comprado')
    assert.deepEqual(h.calls[1].payload, { status: 'Favorito' })
    assert.deepEqual(h.calls[1].filters.at(-1), ['eq', 'status', 'Comprado'])
    await updateMaterialStatus('m1', 'Comprado', null)
    assert.deepEqual(h.calls[2].filters.at(-1), ['is', 'status', null])
    h.result = { data: null, error: null }
    await assert.rejects(updateMaterialStatus('m1', 'Favorito', 'Comprado'), /ha cambiado/)
    const denied = new Error('Permission denied'); h.result = { data: null, error: denied }
    await assert.rejects(updateMaterialStatus('m1', 'Comprado', 'Mirando'), error => error === denied)
  } finally { delete globalThis.__purchaseService }
})

test('card and table show an explicit purchase action and protect bought or received states', async () => {
  const { render } = await bundle({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import MaterialCard from './src/components/materials/MaterialCard.jsx'
    import MaterialsTable from './src/components/materials/MaterialsTable.jsx'
    export function render(status, table, pending = false) {
      const material = { id: 'm1', name: 'Azulejo', status, price: 12, count_in_total: false };
      return renderToStaticMarkup(table
        ? <MaterialsTable materials={[material]} onPurchase={() => {}} purchasingId={pending ? 'm1' : null} />
        : <MaterialCard material={material} onPurchase={() => {}} purchasePending={pending} />);
    }
  ` }, jsx: 'automatic', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/package.json');" },
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  for (const table of [false, true]) {
    let $ = load(render('Mirando', table))
    let button = $('button[aria-label="Marcar comprado: Azulejo"]')
    assert.equal(button.length, 1)
    assert.equal(button.attr('disabled'), undefined)
    assert.match(button.text(), /Marcar comprado/)
    for (const state of ['Comprado', 'Recibido']) {
      $ = load(render(state, table)); button = $(`button[aria-label="${state}: Azulejo"]`)
      assert.equal(button.length, 1)
      assert.notEqual(button.attr('disabled'), undefined)
    }
    $ = load(render('Mirando', table, true)); button = $('button[aria-busy="true"]')
    assert.equal(button.length, 1)
    assert.notEqual(button.attr('disabled'), undefined)
    assert.match(button.text(), /Guardando/)
  }
})
