// Run the local fixture server first; never connects to a real account.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
await mkdir(process.env.UI_OUTPUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  async function analyze() {
    await page.getByRole('button', { name: 'Subir PDF', exact: true }).click()
    await page.getByText('Haz clic o arrastra un PDF aquí', { exact: true }).click()
    await page.getByRole('button', { name: 'Analizar con IA', exact: true }).click()
    await page.getByRole('button', { name: 'Aprobar borrador y guardar', exact: true }).waitFor()
  }
  const create = () => page.getByLabel('Crear proveedor con estos datos al guardar el presupuesto', { exact: true })
  const reviewed = () => page.getByLabel('He revisado el documento y los importes antes de guardar.', { exact: true })
  await page.goto('http://127.0.0.1:4175/presupuestos')
  await analyze()
  assert.equal(await create().isChecked(), false, 'creating the supplier requires opt-in')
  await create().check()
  assert.equal(await page.getByLabel('NIF/CIF del proveedor', { exact: true }).inputValue(), 'B12345678')
  assert.equal(await page.getByLabel('Teléfono del proveedor', { exact: true }).inputValue(), '933123123')
  await reviewed().check()
  await page.getByLabel('Teléfono del proveedor', { exact: true }).fill('933000000')
  assert.equal(await reviewed().isChecked(), false, 'editing invalidates the previous review')
  await page.getByRole('heading', { name: 'Proveedor del presupuesto' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${process.env.UI_OUTPUT}/proveedor-desde-presupuesto.png` })
  await reviewed().check()
  await page.getByRole('button', { name: 'Aprobar borrador y guardar', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await analyze()
  assert.equal(await create().count(), 0)
  assert.notEqual(await page.getByRole('combobox', { name: 'Proveedor guardado del presupuesto', exact: true }).inputValue(), '')
  await page.getByText('Se vinculará al proveedor seleccionado.', { exact: false }).waitFor()
  for (const action of ['Reintentar guardado', 'Comprobar y descartar borrador']) {
    await page.goto('http://127.0.0.1:4175/presupuestos?lostResponse')
    await analyze(); await create().check(); await reviewed().check()
    await page.getByRole('button', { name: 'Aprobar borrador y guardar', exact: true }).click()
    await page.getByRole('button', { name: action, exact: true }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: action, exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await analyze()
    assert.equal(await create().count(), 0, 'the existing supplier is reused after response recovery')
  }
  assert.deepEqual(errors, [])
  console.log('PASS UI: opt-in, datos detectados editables, revisión, alta/vínculo y recuperación de respuesta perdida.')
} finally { await browser.close() }
