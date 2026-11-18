// Accept decimal comma/dot and grouped Spanish/English amounts without
// allowing partial parses or silently turning invalid money into zero.
export function parseMoney(value) {
  if (value === '' || value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  let text = value.trim().replace(/^€\s*|\s*€$/g, '').trim()
  if (!text) return NaN
  // Spaces may separate groups of thousands, but never arbitrary digits.
  if (/\s/.test(text)) {
    if (!/^-?\d{1,3}(?:[\s\u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?$/.test(text)) return NaN
    text = text.replace(/\s/g, '')
  }
  if (/^-?\d+(?:[.,]\d{1,2})?$/.test(text)) return Number(text.replace(',', '.'))
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) return Number(text.replaceAll('.', '').replace(',', '.'))
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return Number(text.replaceAll(',', ''))
  return NaN
}

export function moneyCents(value) {
  const amount = parseMoney(value)
  return Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100)
}

export function validMoney(value) {
  const amount = parseMoney(value)
  return Number.isFinite(amount) && amount >= 0 && amount <= 9999999999.99
    && Math.abs(amount * 100 - moneyCents(amount)) < 0.0001
}
