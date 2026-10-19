// Optional integration check: run the fixture server first. Uses no real accounts.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const output = process.env.UI_OUTPUT
if (!output) throw new Error('Define UI_OUTPUT para las capturas de la prueba.')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/facturas')
  await page.getByRole('button', { name: 'Subir factura', exact: true }).click()
  await page.getByRole('button', { name: 'Seleccionar documento', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0 && !document.body.innerText.includes('Preparando página…'))
  await page.getByRole('button', { name: 'Analizar con IA', exact: true }).click()
  await page.getByRole('heading', { name: 'Comprobación de importes correcta' }).waitFor()
  await page.getByLabel('Total factura (€)', { exact: true }).fill('1300')
  await page.getByText('La base más el IVA no coincide con el total.', { exact: false }).waitFor()
  assert.equal(await page.getByLabel('Total factura (€)', { exact: true }).getAttribute('aria-invalid'), 'true')
  await page.getByLabel('Total factura (€)', { exact: true }).fill('1210')
  await page.getByRole('heading', { name: 'Comprobación de importes correcta' }).waitFor()
  await page.getByRole('button', { name: 'Ampliar documento', exact: true }).click()
  await page.getByText('125%', { exact: true }).waitFor()
  await page.getByRole('dialog').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: `${output}/revision-factura.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => !document.body.innerText.includes('Preparando página…'))
  await page.screenshot({ path: `${output}/revision-movil.png` })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile should not overflow horizontally')
  await page.goto('http://127.0.0.1:4175/presupuestos')
  await page.getByRole('button', { name: 'Subir PDF', exact: true }).click()
  await page.getByText('Haz clic o arrastra un PDF aquí', { exact: true }).click()
  await page.getByRole('button', { name: 'Analizar con IA', exact: true }).click()
  await page.getByRole('button', { name: 'Aprobar borrador y guardar', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Aprobar borrador y guardar', exact: true }).isEnabled(), false)
  await page.getByLabel('Base imponible (€)', { exact: true }).fill('900')
  await page.getByText('La base más el IVA no coincide con el total.', { exact: false }).waitFor()
  await page.goto('http://127.0.0.1:4175/informes')
  for (const name of ['Gastos en Excel (.xlsx)', 'Informe de reforma (.pdf)']) {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name, exact: true }).click()
    const download = await pending
    assert.ok(download.suggestedFilename().endsWith(name.includes('Excel') ? '.xlsx' : '.pdf'))
    assert.equal(await download.failure(), null)
  }
  await page.screenshot({ path: `${output}/informes.png` })
  await page.goto('http://127.0.0.1:4175/informes?error')
  await page.getByRole('button', { name: 'Gastos en Excel (.xlsx)', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /No se pudieron cargar/)
  assert.deepEqual(errors, [])
  console.log('UI OK: visor, zoom, avisos, móvil, presupuesto revisado y descargas Excel/PDF con errores visibles.')
} finally { await browser.close() }
