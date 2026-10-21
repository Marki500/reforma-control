import test from 'node:test'
import assert from 'node:assert/strict'
import { pdfFixture } from './pdfFixtures.mjs'
import { inspectPdf, prepareDocumentContent } from '../server/pdfDocument.js'
import { analysisProblem, assertReadableAnalysis } from '../src/utils/documentAnalysis.js'

const file = modes => ({ mimetype: 'application/pdf', buffer: pdfFixture(modes) })

test('text extraction sends visible content and excludes PDF metadata', async () => {
  const document = file(['text'])
  const inspection = await inspectPdf(document)
  assert.equal(inspection.needsVision, false)
  const source = await prepareDocumentContent(document)
  assert.equal(source.mode, 'text')
  assert.match(source.parts[0].text, /Total 121/)
  assert.doesNotMatch(JSON.stringify(source), /AUTOR_METADATA/)
})

test('scanned and mixed documents render every page without metadata', async () => {
  for (const modes of [['scan'], ['text', 'scan']]) {
    const document = file(modes)
    const progress = []
    document.onAnalysisProgress = update => progress.push(update)
    assert.equal((await inspectPdf(document)).needsVision, true)
    const source = await prepareDocumentContent(document)
    assert.equal(source.mode, 'vision')
    assert.equal(source.pageCount, modes.length)
    assert.deepEqual(progress.filter(update => update.stage === 'rendering').map(update => [update.page, update.page_count]), modes.map((_, index) => [index + 1, modes.length]))
    const images = source.parts.filter(part => part.type === 'image_url')
    assert.equal(images.length, modes.length)
    for (const part of images) assert.match(part.image_url.url, /^data:image\/png;base64,iVBOR/)
    assert.doesNotMatch(JSON.stringify(source), /AUTOR_METADATA/)
  }
})

test('visual retry can render text PDFs; oversized and invalid PDFs fail explicitly', async () => {
  assert.equal((await prepareDocumentContent(file(['text']), { forceVision: true })).mode, 'vision')
  await assert.rejects(prepareDocumentContent(file(Array(9).fill('scan'))), { code: 'PDF_VISION_PAGE_LIMIT' })
  await assert.rejects(prepareDocumentContent({ mimetype: 'application/pdf', buffer: Buffer.from('invalid') }), { code: 'PDF_INVALID' })
})

test('a supplier, warning, quantity or tax rate alone is never a successful extraction', () => {
  for (const kind of ['budget', 'invoice']) {
    const empty = { [`is_${kind}`]: true, supplier_name: 'Autor', tax_rate: 21, line_items: [{ quantity: 4 }] }
    assert.ok(analysisProblem(empty, kind))
    assert.throws(() => assertReadableAnalysis(empty, kind), { code: 'AI_EXTRACTION_INCOMPLETE' })
    assert.equal(analysisProblem({ ...empty, total_amount: 121 }, kind), '')
    assert.equal(analysisProblem({ ...empty, line_items: [{ unit_price: 100 }] }, kind), '')
    assert.ok(analysisProblem({ ...empty, [`is_${kind}`]: false, total_amount: 121 }, kind))
  }
})
