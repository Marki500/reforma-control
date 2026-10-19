import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { PDFParse } from 'pdf-parse'
import { buildReformReport, readReportRows } from '../src/utils/reformReport.js'
import { createExpensesWorkbook } from '../src/utils/reportExcel.js'
import { createReformPdf } from '../src/utils/reportPdf.js'
import { documentReviewIssues } from '../src/utils/documentReview.js'

export const reportFixture = () => buildReformReport({
  project: { project_id: 'demo', name: 'Reforma de prueba · Baño y cocina', estimated_budget: 5000 },
  generatedAt: '2026-10-19T12:00:00Z',
  expenses: [
    { id: 'e1', title: 'Instalación de grifería', vendor: 'Fontanería Ejemplo', amount: 121, paid_amount: 200, category: 'Mano de obra', expense_date: '2026-10-01', notes: '=HYPERLINK("https://example.com")' },
    { id: 'e2', title: 'Azulejos de la cocina', amount: 1000.23, paid_amount: 200.11, category: 'Material', budgeted_amount: 1100, expense_date: '2026-10-02' },
  ],
  invoices: [{ id: 'i1', expense_id: 'e1', total_amount: 121, invoice_number: 'F-001' }],
  tasks: [{ status: 'Completada' }, { status: 'Pendiente' }],
})

test('report keeps invoices inside expenses and debt per expense, with cent precision', () => {
  const report = reportFixture()
  assert.equal(report.totals.amount, 112123)
  assert.equal(report.totals.paid, 40011)
  assert.equal(report.totals.pending, 80012)
  assert.equal(report.totals.invoiced, 12100)
  assert.equal(report.balance, 387877)
  assert.equal(report.tasks.percentage, 50)
  assert.equal(report.rows[0].invoiceNumber, 'F-001')
  const empty = buildReformReport({ project: { name: 'Vacía' } })
  assert.equal(empty.budget, null)
  assert.equal(empty.tasks.percentage, null)
  assert.equal(empty.totals.amount, 0)
})

test('report reads beyond server page limits, scopes every page and rejects partial failures', async () => {
  const calls = []
  const client = { from(table) {
    const call = { table }; calls.push(call)
    return { select() { return this }, eq(key, value) { Object.assign(call, { key, value }); return this }, order() { return this }, range(start, end) { Object.assign(call, { start, end }); return Promise.resolve({ data: Array.from({ length: start === 0 ? 500 : 7 }, (_, index) => ({ id: start + index })) }) } }
  } }
  assert.equal((await readReportRows(client, 'expenses', 'project-A')).length, 507)
  assert.ok(calls.every(call => call.key === 'project_id' && call.value === 'project-A'))
  assert.equal(calls[1].start, 500)
  client.from = () => ({ select() { return this }, eq() { return this }, order() { return this }, range() { return { error: { message: 'Sin acceso' } } } })
  await assert.rejects(readReportRows(client, 'expenses', 'project-A'), /Sin acceso/)
})

test('Excel round-trip preserves numeric amounts, cached formulas and literal untrusted text', async () => {
  const book = await createExpensesWorkbook(reportFixture())
  const bytes = await book.xlsx.writeBuffer()
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(bytes)
  const costs = loaded.getWorksheet('Gastos'), summary = loaded.getWorksheet('Resumen')
  assert.equal(costs.getCell('H2').value, 121)
  assert.equal(costs.getCell('J2').result, 0)
  assert.equal(costs.getCell('J3').value.result, 800.12)
  assert.equal(costs.getCell('M2').type, ExcelJS.ValueType.String)
  assert.match(costs.getCell('M2').value, /^=HYPERLINK/)
  assert.equal(summary.getCell('B8').value.result, 1121.23)
  assert.equal(summary.getCell('B12').value.result, 3878.77)
  assert.equal(costs.views[0].ySplit, 1)
  assert.equal(costs.getCell('L2').value, 'F-001')
  const empty = await createExpensesWorkbook(buildReformReport({ project: { name: 'Vacía' } }))
  assert.equal(empty.getWorksheet('Gastos').rowCount, 1)
})

test('PDF contains the report, readable Spanish amounts and paginated details', async () => {
  const report = reportFixture()
  report.rows = Array.from({ length: 90 }, (_, index) => ({ ...report.rows[index % 2], title: `Partida ${index + 1} · ${report.rows[index % 2].title}` }))
  const doc = createReformPdf(report)
  const parser = new PDFParse({ data: new Uint8Array(doc.output('arraybuffer')) })
  try {
    const result = await parser.getText()
    assert.ok(result.total > 3)
    assert.match(result.text, /Reforma de prueba/)
    assert.match(result.text, /1\.?121,23/)
    assert.match(result.text, /800,12/)
    assert.match(result.text, /Partida 90/)
    assert.match(result.text, /50%/)
  } finally { await parser.destroy() }
})

test('review warnings distinguish missing zero values and update when corrected', () => {
  const values = { name: 'Factura', supplier_name: 'Ejemplo', invoice_number: 'F1', issued_date: '2026-10-19', currency: 'EUR', subtotal: 100, tax_amount: 0, total_amount: 100 }
  assert.deepEqual(documentReviewIssues(values, 'invoice'), [])
  assert.ok(documentReviewIssues({ ...values, total_amount: 121 }, 'invoice').some(issue => /no coincide/.test(issue.message)))
  assert.ok(documentReviewIssues({ ...values, supplier_name: '', total_amount: '' }, 'invoice').some(issue => issue.field === 'supplier_name'))
  assert.ok(documentReviewIssues({ ...values, subtotal: '' }, 'invoice').some(issue => issue.field === 'subtotal'))
})
