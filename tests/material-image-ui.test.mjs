import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { load } from 'cheerio'

test('cards and table request bounded external photos and leave stored copies unchanged', async () => {
  const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import MaterialCard from './src/components/materials/MaterialCard.jsx'
    import MaterialsTable from './src/components/materials/MaterialsTable.jsx'
    export function render(url, table) {
      const material = { id: 'test', name: 'Tile', main_image_url: url, price: 10, quantity: 1, status: 'Mirando' }
      return renderToStaticMarkup(table ? <MaterialsTable materials={[material]} /> : <MaterialCard material={material} />)
    }
  ` }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', write: false,
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/package.json');" },
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const { render } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  const original = 'https://media.adeo.com/media/3459612/media.jpg'
  const stored = 'https://api-reforma.noxumlab.com/storage/v1/object/public/material-images/project/optimized/photo.webp'
  for (const table of [true, false]) {
    const src = load(render(original, table))('img').attr('src')
    assert.equal(new URL(src).searchParams.get('width'), '1200')
    assert.equal(new URL(src).searchParams.get('height'), '1200')
    assert.equal(load(render(stored, table))('img').attr('src'), stored)
  }
})
