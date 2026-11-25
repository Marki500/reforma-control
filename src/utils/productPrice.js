import { parseMoney } from './money.js'

// Never remove arbitrary text/digits: that can join an old and a sale price.
export function parseProductPrice(value) {
  if (value == null || value === '') return null
  const cleaned = typeof value === 'string'
    ? value.trim().replace(/^(?:EUR|USD|GBP|[€$£])\s*|\s*(?:EUR|USD|GBP|[€$£])$/gi, '').trim()
    : value
  if (cleaned === '') return null
  const amount = parseMoney(cleaned)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function priceFromProductText(text) {
  const candidates = []
  for (const line of String(text).split(/\r?\n/)) {
    if (/sin\s+(?:IVA|IGIC)|(?:IVA|IGIC)\s+(?:no\s+incluid[oa]|excluid[oa])|antes\b|ahorra|descuento|cuota|\/\s*mes|al mes|env[ií]o/i.test(line)) continue
    // Require a currency next to the amount; percentages and model numbers aren't prices.
    const amounts = [...line.matchAll(/(?:^|[^\d.,])(?:(\d+(?:[.,\s\u00a0\u202f]\d+)*)\s*(?:EUR|USD|GBP|[€$£])|[€$£]\s*(\d+(?:[.,\s\u00a0\u202f]\d+)*))/gi)]
      .map(match => parseProductPrice(match[1] || match[2])).filter(value => value !== null)
    // Ambiguous old/current price pairs must not be combined or guessed.
    if (amounts.length !== 1) continue
    candidates.push({ price: amounts[0], inclusive: /(?:IVA|IGIC)\s*(?:incluid[oa]|\/)|con\s+(?:IVA|IGIC)/i.test(line) })
  }
  return candidates.find(item => item.inclusive)?.price ?? candidates[0]?.price ?? null
}

export function structuredProducts(value) {
  if (Array.isArray(value)) return value.flatMap(structuredProducts)
  if (!value || typeof value !== 'object') return []
  const types = [].concat(value['@type'] || [])
  if (types.includes('Product')) return [value]
  // MediaMarkt wraps its Product inside BuyAction.object.
  return [value['@graph'], value.object, value.mainEntity].flatMap(structuredProducts)
}

export function priceFromOffers(offers) {
  for (const offer of [].concat(offers || [])) {
    if (!offer || typeof offer !== 'object') continue
    const specifications = [].concat(offer.priceSpecification || []).filter(spec => spec &&
      !/StrikethroughPrice|ListPrice/i.test(String(spec.priceType || '')) && spec.valueAddedTaxIncluded !== false)
    for (const value of [offer.price, ...specifications.map(spec => spec.price)]) {
      const price = parseProductPrice(value)
      if (price !== null) return price
    }
  }
  return null
}
