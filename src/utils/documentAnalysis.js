const positive = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0

export function analysisProblem(draft, kind = 'budget') {
  const invoice = kind === 'invoice'
  if (draft?.[invoice ? 'is_invoice' : 'is_budget'] !== true) {
    return invoice ? 'La IA no reconoce el documento como una factura. Revísalo o rellena los datos manualmente.' : 'La IA no reconoce el documento como un presupuesto. Revísalo o rellena los datos manualmente.'
  }
  const hasAmounts = positive(draft.total_amount) || positive(draft.subtotal)
    || (Array.isArray(draft.line_items) && draft.line_items.some(item => positive(item.total) || positive(item.unit_price)))
  return hasAmounts ? '' : 'La IA no ha podido leer los importes ni las partidas económicas del documento. La extracción no se ha completado; puedes rellenar los datos manualmente.'
}

export function assertReadableAnalysis(draft, kind = 'budget') {
  const message = analysisProblem(draft, kind)
  if (!message) return
  const error = new Error(message)
  error.code = 'AI_EXTRACTION_INCOMPLETE'
  throw error
}
