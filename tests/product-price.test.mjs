import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from 'cheerio'
import { extractProductPrice } from '../server/productPrice.js'
import { parseProductPrice, priceFromProductText } from '../src/utils/productPrice.js'

const extract = (html, host = 'shop.example') => extractProductPrice(load(html), host)

test('product amounts preserve decimal and thousands separators without joining prices', () => {
  for (const [value, expected] of [['1.319 €', 1319], ['1.319,95 €', 1319.95], ['1,319.95', 1319.95], ['1 319,95 EUR', 1319.95], ['0,59', 0.59], ['12.90', 12.9], [0, 0]]) {
    assert.equal(parseProductPrice(value), expected, String(value))
  }
  for (const value of ['20%', 'Antes 100 € ahora 80 €', '12,90 15,90', 'NaN', '€', ' ', null]) assert.equal(parseProductPrice(value), null, String(value))
})

test('visible prices prefer tax-inclusive amounts and exclude installments and shipping', () => {
  assert.equal(priceFromProductText('10 € sin IVA\n12,10 € IVA incluido'), 12.1)
  assert.equal(priceFromProductText('12,10 € IVA no incluido\n14,64 € con IVA'), 14.64)
  assert.equal(priceFromProductText('Cuota 5 €/mes\nEnvío 3 €\n0,59 €'), 0.59)
  assert.equal(priceFromProductText('Antes 100 € ahora 80 €\n20% de descuento'), null)
  assert.equal(priceFromProductText('1,319.95 EUR'), 1319.95)
  assert.equal(priceFromProductText('$1,319.95'), 1319.95)
})

test('MediaMarkt BuyAction.object uses the current offer rather than the crossed-out price', () => {
  // Shape observed in the Beko 1494739 and Hisense 1620665 product pages.
  for (const [sku, price, previous] of [['1494739', 199, 299], ['1620665', 299, 382]]) {
    const data = { '@context': 'https://schema.org/', '@type': 'BuyAction', object: {
      '@type': 'Product', sku, offers: { '@type': 'Offer', priceCurrency: 'EUR', price },
    } }
    const html = `<script type="application/ld+json">${JSON.stringify(data)}</script><main><h1>Electrodoméstico</h1><p data-test="mms-strike-price-type-xop">${previous},– €${previous},00€</p><p>${price},– €${price},00€</p><p>En 6 cuotas 35,02 € Mensual</p></main>`
    assert.equal(extract(html, 'mediamarkt.es'), price)
  }
})

test('structured prices support arrays, graphs and price specifications', () => {
  for (const data of [
    [{ '@type': 'Product', offers: { price: '1.319' } }],
    { '@graph': [{ '@type': ['Product'], offers: [{ price: '1.319' }] }] },
    { '@type': 'Product', offers: { priceSpecification: [{ price: '2.000', priceType: 'https://schema.org/StrikethroughPrice' }, { price: '1.319' }] } },
  ]) assert.equal(extract(`<script type="application/ld+json">${JSON.stringify(data)}</script>`), 1319)
})

test('extracts property metadata, text microdata, data attributes and cheap prices', () => {
  for (const html of ['<meta property="product:price:amount" content="0.59">', '<span itemprop="price">0,59 €</span>', '<div data-price="0.59"></div>']) assert.equal(extract(html), 0.59)
})

test('Amazon imports the full amount, including cents', () => {
  assert.equal(extract('<div class="a-price"><span class="a-offscreen">1.319,95 €</span><span class="a-price-whole">1.319,</span><span class="a-price-fraction">95</span></div>', 'amazon.es'), 1319.95)
})

test('ignores discounts and struck-through prices instead of merging them', () => {
  assert.equal(extract('<div class="product-price"><del>100 €</del><span>80,99 €</span></div>'), 80.99)
  assert.equal(extract('<span class="price-percent-reduction">20%</span>'), null)
  assert.equal(extract('<div class="product-price">20%</div>'), null)
})

test('fallback ignores scripts, cart, tax-exclusive amounts and related products', () => {
  assert.equal(extract('<header>Carrito 20 €</header><script>"precio": "9 €"</script><main><h1>Aerotermo</h1><p>1.090,08 € sin IVA</p><p>1.319 € IVA / Unidad</p><h2>Otros productos</h2><p>995 €</p></main>'), 1319)
  assert.equal(extract('<main><h1>Aerotermo</h1><h2>Otros productos</h2><p>995 €</p></main>'), null)
  assert.equal(extract('<script>const price = "20 €"</script>'), null)
})
