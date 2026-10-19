export const invoiceCategories = ['Material', 'Mano de obra', 'Transporte', 'Licencia', 'Otro']
export const invoiceMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const invoiceExtensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const normalizeInvoiceKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function duplicateInvoice(invoices, form) {
  const number = normalizeInvoiceKey(form.invoice_number)
  if (!number) return null
  return invoices.find(invoice => normalizeInvoiceKey(invoice.invoice_number) === number && (
    (form.supplier_id && invoice.supplier_id === form.supplier_id)
    || (normalizeInvoiceKey(form.supplier_name) && normalizeInvoiceKey(invoice.supplier_name) === normalizeInvoiceKey(form.supplier_name))
    || (normalizeInvoiceKey(form.supplier_tax_id) && normalizeInvoiceKey(invoice.supplier_tax_id) === normalizeInvoiceKey(form.supplier_tax_id))
  )) || null
}

export function validateInvoice(form) {
  if (!form.name.trim()) return 'Escribe el concepto de la factura.'
  if (!form.supplier_name.trim()) return 'Indica el proveedor que emite la factura.'
  if (!normalizeInvoiceKey(form.invoice_number)) return 'Indica el número de factura.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.issued_date || '')) return 'Indica la fecha de emisión.'
  if (form.currency !== 'EUR') return 'Esta versión registra facturas en EUR. No se realiza conversión de moneda.'
  const total = Number(form.total_amount), paid = Number(form.paid_amount || 0)
  if (!Number.isFinite(total) || total <= 0) return 'El total debe ser un importe positivo.'
  if (!Number.isFinite(paid) || paid < 0 || paid > total) return 'Lo pagado debe estar entre cero y el total de la factura.'
  for (const field of ['subtotal', 'tax_amount', 'tax_rate']) {
    if (form[field] !== '' && form[field] != null && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) return 'La base y los impuestos deben ser importes válidos, sin valores negativos.'
  }
  if (form.subtotal !== '' && form.tax_amount !== '' && Math.abs(Number(form.subtotal) + Number(form.tax_amount) - total) > 0.05) return 'La base imponible más el IVA no coincide con el total. Revisa los importes.'
  return ''
}

export function expenseInvoice(expense) {
  return Array.isArray(expense.invoices) ? expense.invoices[0] : expense.invoices
}
