import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duplicateInvoice, validateInvoice } from '../src/utils/invoices.js'
import { sanitizeInvoiceAnalysis } from '../server/invoiceAnalysis.js'

const valid = { name: 'Ventanas', supplier_name: 'Carpintería Sur', supplier_tax_id: 'B12345678', invoice_number: 'F-2026/01', issued_date: '2026-10-19', currency: 'EUR', total_amount: '121', subtotal: '100', tax_amount: '21', tax_rate: '21', paid_amount: '0' }
test('invoice extraction does not infer payments or invent missing dates and identifiers', () => {
  const result = sanitizeInvoiceAnalysis({ is_invoice: true, total_amount: 121, paid_amount: 121, issued_date: '2026-02-31', due_date: '2026-10-30' })
  assert.equal(result.is_invoice, true)
  assert.equal(result.invoice_number, '')
  assert.equal(result.issued_date, '')
  assert.equal(result.due_date, '2026-10-30')
  assert.equal('paid_amount' in result, false)
})
test('invoice extraction preserves currency and warns about discrepancies and credit notes', () => {
  const result = sanitizeInvoiceAnalysis({ is_invoice: true, currency: 'USD', subtotal: 100, tax_amount: 21, total_amount: 140 })
  assert.equal(result.currency, 'USD')
  assert.equal(result.warnings.length, 2)
  const credit = sanitizeInvoiceAnalysis({ is_invoice: true, total_amount: -100 })
  assert.equal(credit.total_amount, null)
  assert.match(credit.warnings[0], /negativo/)
})
test('duplicates match provider identity and invoice number independently of formatting', () => {
  assert.ok(duplicateInvoice([{ ...valid }], { ...valid, supplier_name: 'CARPINTERIA SUR', invoice_number: 'F202601' }))
  assert.ok(duplicateInvoice([{ ...valid }], { ...valid, supplier_name: 'Otro nombre', supplier_tax_id: 'B-12345678' }))
  assert.equal(duplicateInvoice([{ ...valid }], { ...valid, supplier_name: 'Otra empresa', supplier_tax_id: 'B99999999' }), null)
})
test('only reviewed, coherent EUR amounts can become an expense', () => {
  assert.equal(validateInvoice(valid), '')
  assert.match(validateInvoice({ ...valid, currency: 'USD' }), /EUR/)
  assert.match(validateInvoice({ ...valid, paid_amount: '122' }), /pagado/)
  assert.match(validateInvoice({ ...valid, tax_amount: '20' }), /no coincide/)
  assert.match(validateInvoice({ ...valid, total_amount: -121 }), /positivo/)
})
