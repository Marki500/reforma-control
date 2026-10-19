import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { money } from './reformReport.js'

const euros = value => `${money(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
// Built-in PDF fonts cover Spanish/WinAnsi. Replace unsupported glyphs instead
// of producing broken glyph positions (e.g. emoji in free-text titles).
const text = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[^\u0020-\u00ff\u20ac]/gu, '?')

export function createReformPdf(report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setProperties({ title: `Informe de reforma: ${text(report.project.name)}`, author: 'NIVEL' })
  const table = (head, body, startY = 40, columns = {}) => autoTable(doc, { head: [head], body, startY, margin: { left: 16, right: 16, top: 22, bottom: 20 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [89, 97, 70] }, columnStyles: columns, rowPageBreak: 'avoid' })
  doc.setTextColor(89, 97, 70); doc.setFontSize(12); doc.text('NIVEL / INFORME DE LA REFORMA', 16, 20)
  doc.setTextColor(35, 35, 35); doc.setFontSize(21)
  const name = doc.splitTextToSize(text(report.project.name || 'Mi reforma'), 178)
  // Bound the cover title; the full project name is retained in PDF metadata.
  doc.text(name.slice(0, 3), 16, 33)
  const top = 39 + Math.min(name.length, 3) * 8
  doc.setFontSize(9); doc.text(`Generado: ${new Date(report.generatedAt).toLocaleString('es-ES')} · EUR`, 16, top)
  table(['Indicador', 'Situación actual'], [
    ['Presupuesto general', report.budget === null ? 'Sin definir' : euros(report.budget)],
    ['Gastos registrados', euros(report.totals.amount)], ['Facturado (incluido en Gastos)', euros(report.totals.invoiced)],
    ['Pagado', euros(report.totals.paid)], ['Pendiente de pago', euros(report.totals.pending)],
    ['Margen sobre gastos registrados', report.balance === null ? 'Sin presupuesto general' : euros(report.balance)],
    ['Avance de tareas', report.tasks.total ? `${report.tasks.done} de ${report.tasks.total} completadas (${report.tasks.percentage}%)` : 'Sin tareas registradas'],
  ], top + 8)
  let y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(9)
  const notes = 'Las facturas ya forman parte de los gastos: no se suman otra vez. El pendiente se calcula por gasto. El margen considera solo gastos registrados; no es una previsión del coste final. Avance medido por número de tareas, sin ponderar su duración.'
  doc.text(doc.splitTextToSize(notes, 178), 16, y)
  doc.addPage(); doc.setFontSize(16); doc.text('Gastos por categoría', 16, 32)
  table(['Categoría', 'Registrado', 'Pagado', 'Pendiente'], report.categories.length ? report.categories.map(row => [text(row.name), euros(row.amount), euros(row.paid), euros(row.pending)]) : [['Sin gastos registrados', '-', '-', '-']], 40)
  doc.addPage(); doc.setFontSize(16); doc.text('Detalle de gastos', 16, 32)
  table(['Concepto / proveedor', 'Factura / fecha', 'Importe', 'Pagado', 'Pendiente'], report.rows.length ? report.rows.map(row => [text(`${row.title}\n${row.supplier}`), text(`${row.invoiceNumber || 'Sin factura'} / ${row.date || 'Sin fecha'}`), euros(row.amount), euros(row.paid), euros(row.pending)]) : [['Sin gastos registrados', '-', '-', '-', '-']], 40, { 0: { cellWidth: 62 }, 1: { cellWidth: 43 } })
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(110)
    doc.text('NIVEL · Datos de la reforma activa al generar el informe', 16, 287)
    doc.text(`${page} / ${pages}`, 194, 287, { align: 'right' })
  }
  return doc
}
