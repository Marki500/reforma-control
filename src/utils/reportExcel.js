import ExcelJS from 'exceljs'
import { money } from './reformReport.js'

const currency = '#,##0.00 "€";[Red]-#,##0.00 "€"'
function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF596146' } }
  row.height = 30
  row.alignment = { vertical: 'middle', wrapText: true }
}

export async function createExpensesWorkbook(report) {
  const book = new ExcelJS.Workbook()
  book.creator = 'NIVEL'; book.created = new Date(report.generatedAt)
  book.calcProperties.fullCalcOnLoad = true
  const summary = book.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  summary.columns = [{ width: 42 }, { width: 54 }]
  summary.addRow(['NIVEL · Informe de la reforma', '']); summary.getRow(1).font = { bold: true, size: 18 }
  summary.mergeCells('A1:B1'); summary.getRow(1).height = 32
  summary.addRow(['Reforma', report.project.name]); summary.addRow(['Generado', new Date(report.generatedAt).toLocaleString('es-ES')])
  summary.addRow(['Alcance', 'Reforma activa · Todos los gastos']); summary.addRow([])
  styleHeader(summary.addRow(['Indicador', 'Importe / avance']))
  const dataRows = [
    ['Presupuesto general', report.budget === null ? 'Sin definir' : money(report.budget)],
    ['Gastos registrados', money(report.totals.amount)], ['Facturado (incluido en gastos)', money(report.totals.invoiced)],
    ['Pagado', money(report.totals.paid)], ['Pendiente de pago', money(report.totals.pending)],
    ['Margen sobre gastos registrados', report.balance === null ? 'Sin presupuesto' : money(report.balance)],
    ['Tareas completadas', `${report.tasks.done} de ${report.tasks.total}`],
  ]
  for (const row of dataRows) { const added = summary.addRow(row); if (typeof row[1] === 'number') added.getCell(2).numFmt = currency }
  summary.addRow([])
  summary.addRow(['Lectura de los datos', 'Las facturas ya están incluidas en Gastos. No sumar ambos importes.'])
  summary.addRow(['Pendiente', 'Se calcula por gasto; los pagos de más no compensan otras deudas.'])
  summary.addRow(['Presupuesto general', 'Proviene de los datos de la reforma, no de sumar ofertas alternativas.'])
  summary.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; if (row.number >= 16) row.height = 54 })

  const sheet = book.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 1 }] })
  const headers = ['Concepto', 'Categoría', 'Proveedor', 'Estancia', 'Fecha', 'Vencimiento', 'Presupuestado (€)', 'Importe (€)', 'Pagado (€)', 'Pendiente (€)', 'Estado', 'N.º factura', 'Notas']
  sheet.columns = headers.map((header, i) => ({ header, width: [38, 22, 28, 22, 14, 14, 20, 18, 18, 18, 16, 22, 55][i] }))
  styleHeader(sheet.getRow(1))
  for (const [index, row] of report.rows.entries()) {
    const line = index + 2
    const added = sheet.addRow([row.title, row.category, row.supplier, row.room, row.date, row.dueDate, money(row.budgeted), money(row.amount), money(row.paid), { formula: `MAX(H${line}-I${line},0)`, result: money(row.pending) }, { formula: `IF(AND(H${line}>0,I${line}>=H${line}),"Pagado",IF(I${line}>0,"Parcial","Pendiente"))`, result: row.status }, row.invoiceNumber, row.notes])
    added.alignment = { vertical: 'top', wrapText: true }
    added.height = Math.min(409, Math.max(42, ...[row.title, row.supplier, row.notes].map((value, i) => Math.ceil(String(value).length / [34, 24, 50][i]) * 15 + 8)))
    for (let col = 7; col <= 10; col++) added.getCell(col).numFmt = currency
  }
  sheet.autoFilter = { from: 'A1', to: `M${Math.max(1, report.rows.length + 1)}` }
  if (report.rows.length) {
    const end = report.rows.length + 1
    const total = sheet.addRow(['TOTAL'])
    for (const [column, key] of [[7, 'budgeted'], [8, 'amount'], [9, 'paid'], [10, 'pending']]) {
      const letter = String.fromCharCode(64 + column)
      total.getCell(column).value = { formula: `SUM(${letter}2:${letter}${end})`, result: money(report.totals[key]) }
      total.getCell(column).numFmt = currency
    }
    total.font = { bold: true }; total.height = 28
    for (const [summaryRow, col] of [[8, 'H'], [10, 'I'], [11, 'J']]) summary.getCell(`B${summaryRow}`).value = { formula: `SUM(Gastos!${col}2:${col}${end})`, result: money(report.totals[{ H: 'amount', I: 'paid', J: 'pending' }[col]]) }
    if (report.budget !== null) summary.getCell('B12').value = { formula: 'B7-B8', result: money(report.balance) }
  }
  return book
}
