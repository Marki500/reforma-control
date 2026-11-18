import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

test('payment editor renders differences in euros and accepts decimal text inputs', async () => {
  const { outputFiles } = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { PaymentPhasesEditor } from './src/components/expenses/PaymentPhases.jsx'
        export function render(amount) {
          return renderToStaticMarkup(<PaymentPhasesEditor
            form={{ amount: '1.000,00', paid_amount: 0, payment_phases: [
              { id: 'phase', title: 'Obra', amount, paid: false }
            ] }} onChange={() => {}} />)
        }
      `,
      resolveDir: process.cwd(), loader: 'jsx',
    },
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', write: false,
    // React's server renderer uses Node builtins. Keep their imports in ESM.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/package.json');" },
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const { render } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  const under = render('999,00')
  assert.match(under, /Falta distribuir 1,00/)
  assert.doesNotMatch(under, /Falta distribuir 100,00/)
  assert.match(under, /type="text" inputMode="decimal"/)
  assert.match(render('1.001,00'), /superan el coste final en 1,00/)
  assert.match(render('1,000.00'), /La suma de las fases coincide/)
  assert.match(render('no válido'), /Revisa los importes/)
})
