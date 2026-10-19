export function documentReviewIssues(values, kind = 'budget') {
  const issues = []
  const missing = key => values[key] == null || String(values[key]).trim() === ''
  const required = kind === 'invoice'
    ? [['name', 'Concepto'], ['supplier_name', 'Emisor'], ['invoice_number', 'Número de factura'], ['issued_date', 'Fecha de emisión'], ['currency', 'Moneda']]
    : [['name', 'Nombre'], ['issued_date', 'Fecha de emisión']]
  for (const [field, label] of required) if (missing(field)) issues.push({ field, message: `${label}: dato pendiente de revisar.` })
  if (missing('total_amount') || !Number.isFinite(Number(values.total_amount)) || Number(values.total_amount) <= 0) issues.push({ field: 'total_amount', message: 'Total: confirma un importe mayor que cero.' })
  if (!missing('subtotal') && !missing('tax_amount') && !missing('total_amount')) {
    const difference = Math.round((Number(values.subtotal) + Number(values.tax_amount) - Number(values.total_amount)) * 100)
    if (Math.abs(difference) > 5) issues.push({ field: 'total_amount', message: 'La base más el IVA no coincide con el total. Comprueba los tres importes.' })
  }
  for (const [field, label] of [['subtotal', 'Base imponible'], ['tax_amount', 'IVA total']]) if (missing(field)) issues.push({ field, message: `${label}: no informado; compruébalo en el documento.` })
  return issues
}
