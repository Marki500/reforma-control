import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sanitizeBudgetAnalysis } from '../server/budgetAnalysis.js'

test('budget analysis sanitizes fields and validates calculated totals', () => {
  const result = sanitizeBudgetAnalysis({
    is_budget: true,
    document_title: '  Reforma baño  ',
    issued_date: '14/10/2026',
    subtotal: 100,
    tax_amount: 21,
    total_amount: 125,
    line_items: [{ description: ' Alicatado ', quantity: 2, unit: 'm²', unit_price: 50, total: 100 }],
  })
  assert.equal(result.document_title, 'Reforma baño')
  assert.equal(result.issued_date, '')
  assert.equal(result.line_items[0].description, 'Alicatado')
  assert.match(result.warnings[0], /no coincide/)
})

test('budget analysis rejects unsafe numeric values and excess line items', () => {
  const result = sanitizeBudgetAnalysis({ total_amount: -1, line_items: Array.from({ length: 250 }, (_, index) => ({ description: `Partida ${index}` })) })
  assert.equal(result.total_amount, null)
  assert.equal(result.line_items.length, 200)
})
