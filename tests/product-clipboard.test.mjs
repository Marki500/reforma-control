import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productFromClipboard } from '../src/utils/productClipboard.js'

const url = 'https://www.obramat.es/productos/aerotermo-acs-250l-nuos-fit-s2-ariston-25112023.html'
test('imports Obramat title and tax-inclusive Spanish price, ignoring navigation', () => {
  const product = productFromClipboard('Carrito 20 €\nAEROTERMO ACS 250L NUOS FIT S2 ARISTON\n1.090,08 € sin IVA\n1.319 € IVA / Unidad\nOtros productos\n995 €', url)
  assert.equal(product.name, 'AEROTERMO ACS 250L NUOS FIT S2 ARISTON')
  assert.equal(product.price, 1319)
  assert.equal(product.storeName, 'obramat.es')
})
test('handles decimal prices and missing data without inventing values', () => {
  assert.equal(productFromClipboard('12,90 €', url).price, 12.9)
  assert.equal(productFromClipboard('12.90 EUR', url).price, 12.9)
  assert.equal(productFromClipboard('Sin precio', url).price, null)
  assert.equal(productFromClipboard('Sin precio', url).name, '')
  assert.throws(() => productFromClipboard('Producto', 'javascript:alert(1)'))
  assert.throws(() => productFromClipboard('', url))
})
