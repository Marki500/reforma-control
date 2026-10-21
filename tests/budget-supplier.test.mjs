import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetSupplierDraft, matchingBudgetSuppliers, validateBudgetSupplier } from '../src/utils/budgetSupplier.js'
import { sanitizeBudgetAnalysis, budgetAnalysisSchema } from '../server/budgetAnalysis.js'

test('supplier extraction keeps only supplied contact data, bounded and without invented defaults', () => {
  const draft = sanitizeBudgetAnalysis({ supplier_name: ' Taller Sur ', supplier_tax_id: ' B123 ', supplier_phone: ' 933123123 ', supplier_email: ' taller@example.com ', supplier_address: ' Calle de ejemplo 1 ' })
  assert.deepEqual(budgetSupplierDraft(draft), { name: 'Taller Sur', tax_id: 'B123', phone: '933123123', email: 'taller@example.com', address: 'Calle de ejemplo 1' })
  assert.equal(budgetSupplierDraft(sanitizeBudgetAnalysis({ supplier_name: 'Solo nombre' })).phone, '')
  assert.equal(sanitizeBudgetAnalysis({ supplier_address: 'a'.repeat(700) }).supplier_address.length, 500)
  for (const field of ['supplier_tax_id', 'supplier_phone', 'supplier_email', 'supplier_address']) assert.ok(budgetAnalysisSchema.required.includes(field))
})

test('supplier matches prefer tax identity, normalize names, retain ambiguous matches and include archived records', () => {
  const rows = [{ id: 'a', name: 'Fontanería Sur, S.L.', tax_id: 'B-123', status: 'Archivado' }, { id: 'b', name: 'Fontaneria Sur SL', tax_id: '' }]
  assert.equal(matchingBudgetSuppliers(rows, { name: 'Otro nombre', tax_id: 'b123' })[0].id, 'a')
  assert.equal(matchingBudgetSuppliers(rows, { name: 'FONTANERÍA SUR S.L.' }).length, 2)
  assert.deepEqual(matchingBudgetSuppliers([rows[0]], { name: rows[0].name, tax_id: 'B999' }), [])
  assert.deepEqual(matchingBudgetSuppliers(rows, { name: '', tax_id: '' }), [])
  assert.equal(validateBudgetSupplier({ name: 'Taller', email: '' }), '')
  assert.match(validateBudgetSupplier({ name: 'Taller', email: 'mal' }), /correo/)
})
