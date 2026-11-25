import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { filterExpenses } from '../src/utils/expenses.js'

async function chartRenderer() {
  const { outputFiles } = await build({ entryPoints: ['src/components/expenses/ExpensesByPerson.jsx'], bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'shallow-react', setup(b) {
      b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useMemo = fn => fn(); export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;' }))
    } }],
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)).default
}

function buttons(node) {
  if (Array.isArray(node)) return node.flatMap(buttons)
  if (!node || typeof node !== 'object') return []
  return [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)]
}

test('chart clicks select, switch and clear payers while retaining the other filters', async () => {
  const render = await chartRenderer()
  const expenses = [
    { id: 'ana-material', payer_user_id: 'ana', amount: 100, paid_amount: 50, category: 'Material' },
    { id: 'ana-labour', payer_user_id: 'ana', amount: 200, paid_amount: 100, category: 'Mano de obra' },
    { id: 'marc-material', payer_user_id: 'marc', amount: 150, paid_amount: 150, category: 'Material' },
    { id: 'unassigned', payer_user_id: null, amount: 20, paid_amount: 0, category: 'Material' },
    { id: 'former', payer_user_id: 'former-user', amount: 40, paid_amount: 0, category: 'Material' },
  ]
  const members = [{ user_id: 'ana', display_name: 'Ana' }, { user_id: 'marc', display_name: 'Marc' }]
  let filters = { search: '', category: 'Material', payer_user_id: '' }
  const tree = () => render({ expenses, members, selectedPayer: filters.payer_user_id, onSelectPayer: id => { filters = { ...filters, payer_user_id: id } } })
  const button = label => buttons(tree()).find(node => node.props['aria-label'] === `Filtrar gastos: ${label}`)
  const visibleIds = () => filterExpenses(expenses, filters).map(item => item.id)

  assert.equal(button('Ana').props.type, 'button')
  assert.equal(button('Ana').props['aria-pressed'], false)
  button('Ana').props.onClick()
  assert.equal(button('Ana').props['aria-pressed'], true)
  assert.deepEqual(visibleIds(), ['ana-material'])
  button('Marc').props.onClick()
  assert.equal(button('Ana').props['aria-pressed'], false)
  assert.deepEqual(visibleIds(), ['marc-material'])
  button('Marc').props.onClick()
  assert.equal(filters.payer_user_id, '')
  assert.equal(filters.category, 'Material')
  assert.equal(visibleIds().length, 4)
  button('Sin asignar').props.onClick()
  assert.equal(filters.payer_user_id, 'unassigned')
  assert.deepEqual(visibleIds(), ['unassigned'])
  button('Antiguo miembro 1').props.onClick()
  assert.equal(filters.payer_user_id, 'former-user')
  assert.deepEqual(visibleIds(), ['former'])
})
