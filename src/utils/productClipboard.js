import { normalizeProductUrl } from './productUrl.js'

export function productFromClipboard(text, value, details = {}) {
  const url = new URL(normalizeProductUrl(value))
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Introduce una URL http o https del producto.')
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) throw new Error('Copia y pega primero el contenido de la ficha del producto.')
  const slug = url.pathname.split('/').pop().replace(/\.html?$/i, '').replace(/-\d+$/, '').replaceAll('-', ' ')
  const matchingTitle = lines.find(line => line.toLowerCase() === slug.toLowerCase())
  const name = details.name || matchingTitle || ''
  // Ignore navigation prices before the product title and prices without tax.
  const titleIndex = lines.findIndex(line => line === name)
  const candidates = lines.slice(Math.max(0, titleIndex))
  let price = null
  for (const line of candidates) {
    if (/sin\s+IVA|IVA\s+excluido|IGIC\s+excluido/i.test(line)) continue
    const match = line.match(/(?:^|[^\d.,])(\d+\.\d{2}(?!\d)|\d+(?:[.\s]\d{3})*(?:,\s*\d{2})?)\s*(?:€|EUR)/i)
    if (!match) continue
    const raw = match[1].replace(/\s/g, '')
    price = Number(raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replaceAll('.', '') : raw)
    break
  }
  return {
    name, price, image: details.image || '', brand: '', model: '', currency: 'EUR',
    storeName: url.hostname.replace(/^www\./, ''), productUrl: url.href,
    description: '', availability: '',
  }
}

// Read inert clipboard HTML without inserting any markup in the document.
export function clipboardHtmlDetails(html, value) {
  if (!html) return {}
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const name = doc.querySelector('h1')?.textContent?.trim() || ''
  const images = [...doc.querySelectorAll('img')]
  const image = images.find(img => name && img.alt?.trim().toLowerCase().startsWith(name.toLowerCase()))
  let imageUrl = ''
  try {
    const parsed = new URL(image?.getAttribute('src') || image?.getAttribute('data-src') || '', value)
    if (image && ['http:', 'https:'].includes(parsed.protocol)) imageUrl = parsed.href
  } catch {}
  return { name, image: imageUrl }
}
