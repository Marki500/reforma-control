import { parseProductPrice, priceFromProductText, priceFromOffers, structuredProducts } from '../src/utils/productPrice.js'
export { structuredProducts } from '../src/utils/productPrice.js'

export function extractProductPrice($, hostname) {
  // JSON-LD can be an array, an @graph, or a single product.
  let structured = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (structured !== null) return
    try {
      for (const product of structuredProducts(JSON.parse($(el).text()))) {
        structured = priceFromOffers(product.offers)
        if (structured !== null) break
      }
    } catch { /* A malformed block must not hide the other sources. */ }
  })
  if (structured !== null) return structured

  for (const selector of ['meta[property="product:price:amount"]', 'meta[name="product:price:amount"]', 'meta[property="og:price:amount"]', 'meta[itemprop="price"]', '[itemprop="price"]']) {
    let price = null
    $(selector).each((_, el) => {
      if (price !== null || $(el).closest('del, s, .old-price, .regular-price').length) return
      price = parseProductPrice($(el).attr('content') || $(el).text().trim())
    })
    if (price !== null) return price
  }

  const amazon = /(^|\.)amazon\.(es|com)$/.test(hostname)
  const selectors = [
    ...(amazon ? ['#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen', '.a-price:not(.a-text-price) .a-offscreen'] : []),
    '.climamarket-price', '.big-price', '.current-price .price', '.price_sale',
    '.product-price', '[data-price]', '.price .amount', '.precio', '#our_price_display',
  ]
  for (const selector of selectors) {
    let price = null
    $(selector).each((_, el) => {
      if (price !== null || $(el).closest('del, s, .old-price, .regular-price').length) return
      const node = $(el).clone()
      node.find('del, s, .old-price, .regular-price').remove()
      const text = node.text().trim()
      if (/sin\s+IVA|IVA\s+excluido|\/\s*mes|al mes|%/i.test(text)) return
      price = parseProductPrice(node.attr('content') || node.attr('data-price') || text) ?? priceFromProductText(text)
    })
    if (price !== null) return price
  }

  // Visible product content only: scripts and the cart frequently contain other prices.
  const content = ($('main').first().length ? $('main').first() : $('body')).clone()
  content.find('script, style, noscript, nav, header, footer, aside, del, s, .old-price, .regular-price').remove()
  content.find('br').replaceWith('\n')
  content.find('h1, h2, h3, p, div, li, tr').append('\n')
  let text = content.text()
  const title = content.find('h1').first().text().trim()
  if (!title) return null
  text = text.slice(text.indexOf(title) + title.length).split(/otros productos|productos relacionados|tambi[eé]n te puede|recomendados/i)[0]
  return priceFromProductText(text)
}
