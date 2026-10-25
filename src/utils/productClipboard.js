import { normalizeProductUrl } from './productUrl.js'

export function productFromClipboard(text, value, details = {}) {
  const url = new URL(normalizeProductUrl(value))
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Introduce una URL http o https del producto.')
  if (/<(?:div|html|body|h1|img|picture|section|meta)\b/i.test(text)) {
    details = clipboardHtmlDetails(text, url.href)
    text = details.text
  }
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
  // A template keeps scripts, images and other resources inert while parsing.
  const template = document.createElement('template')
  template.innerHTML = html
  const doc = template.content
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach(node => node.remove())
  const heading = doc.querySelector('h1')?.cloneNode(true)
  heading?.querySelectorAll('a, .mu-accessibility-hidden, [aria-hidden="true"]').forEach(node => node.remove())
  const name = heading?.textContent?.replace(/\s+/g, ' ').trim() || ''
  const images = [...doc.querySelectorAll('img')]
  const image = images.find(img => name && img.alt?.trim().toLowerCase().startsWith(name.toLowerCase()))
    || doc.querySelector('#product-carousel img, [itemprop="image"], .product-image img')
  let imageUrl = ''
  for (const source of [image?.getAttribute('data-src'), image?.getAttribute('src'), doc.querySelector('meta[property="og:image"]')?.getAttribute('content')]) {
    if (!source) continue
    try {
      const parsed = new URL(source, value)
      if (['http:', 'https:'].includes(parsed.protocol)) { imageUrl = parsed.href; break }
    } catch {}
  }
  // Separate blocks while preserving adjacent spans inside prices.
  doc.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
  doc.querySelectorAll('h1, h2, h3, p, div, li, tr').forEach(node => node.append('\n'))
  const text = doc.textContent.replace(/[^\S\n]+/g, ' ')
  return { name, image: imageUrl, text }
}
