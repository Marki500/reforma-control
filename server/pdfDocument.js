import { PDFParse } from 'pdf-parse'

export const MAX_VISION_PAGES = 8
const MAX_PDF_PAGES = 80
const MAX_TEXT_CHARACTERS = 120000
const MAX_VISUAL_BYTES = 12 * 1024 * 1024

export class PdfDocumentError extends Error {
  constructor(message, code = 'PDF_INVALID') { super(message); this.code = code }
}

const contentText = value => String(value || '').replace(/\0/g, '').replace(/[ \t]+\n/g, '\n').trim()
const textLength = value => contentText(value).replace(/[^\p{L}\p{N}]/gu, '').length

// The cache lives only on this job's in-memory file. Metadata (Author, Creator,
// filename) never becomes evidence of a supplier or an economic value.
export function inspectPdf(file) {
  if (!file.pdfInspection) file.onAnalysisProgress?.({ stage: 'preparing' })
  file.pdfInspection ||= inspectPdfBuffer(file.buffer)
  return file.pdfInspection
}

async function inspectPdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const info = await parser.getInfo()
    if (!info.total || info.total > MAX_PDF_PAGES) throw new PdfDocumentError(`El PDF debe tener entre 1 y ${MAX_PDF_PAGES} páginas para analizarlo.`, 'PDF_PAGE_LIMIT')
    // Disable synthetic page footers so they cannot be mistaken for document text.
    const result = await parser.getText({ pageJoiner: '' })
    const pages = result.pages.map(page => ({ pageNumber: page.num, text: contentText(page.text) }))
    const needsVision = pages.some(page => textLength(page.text) < 80)
    const text = pages.map(page => `[Página ${page.pageNumber} de ${info.total}]\n${page.text}`).join('\n\n')
    if (text.length > MAX_TEXT_CHARACTERS) throw new PdfDocumentError('El documento contiene demasiado texto para un único análisis. Divídelo en documentos completos más pequeños.', 'PDF_TEXT_LIMIT')
    return { pageCount: info.total, pages, text, needsVision }
  } catch (error) {
    if (error instanceof PdfDocumentError) throw error
    throw new PdfDocumentError('No se pudo abrir el PDF. Comprueba que es válido y que no está protegido con contraseña.')
  } finally { await parser.destroy().catch(() => {}) }
}

export async function renderPdfPages(file) {
  const inspection = await inspectPdf(file)
  if (inspection.pageCount > MAX_VISION_PAGES) throw new PdfDocumentError(`La lectura visual admite hasta ${MAX_VISION_PAGES} páginas por documento. Divide el PDF o rellena los datos manualmente. No se ha analizado solo una parte.`, 'PDF_VISION_PAGE_LIMIT')
  const parser = new PDFParse({ data: file.buffer })
  try {
    const info = await parser.getInfo({ parsePageInfo: true })
    const pages = []
    let bytes = 0
    for (const page of info.pages) {
      file.onAnalysisProgress?.({ stage: 'rendering', page: page.pageNumber, page_count: inspection.pageCount })
      if (!(page.width > 0) || !(page.height > 0)) throw new PdfDocumentError('El PDF contiene una página con dimensiones no válidas.')
      // Bound both axes, not only the width, before allocating a canvas.
      const scale = Math.min(1800 / page.width, 2600 / page.height)
      const result = await parser.getScreenshot({ partial: [page.pageNumber], scale, imageDataUrl: false, imageBuffer: true })
      const image = result.pages[0]
      if (!image?.data?.length) throw new PdfDocumentError('No se pudo convertir una página del PDF para su lectura visual.', 'PDF_RENDER_FAILED')
      bytes += image.data.length
      if (bytes > MAX_VISUAL_BYTES) throw new PdfDocumentError('Las páginas del PDF ocupan demasiado para un único análisis visual. Divide el documento o rellénalo manualmente.', 'PDF_VISION_SIZE_LIMIT')
      pages.push({ pageNumber: page.pageNumber, dataUrl: `data:image/png;base64,${Buffer.from(image.data).toString('base64')}`, width: image.width, height: image.height })
    }
    if (pages.length !== inspection.pageCount) throw new PdfDocumentError('No se pudieron preparar todas las páginas del PDF.', 'PDF_RENDER_FAILED')
    return pages
  } catch (error) {
    if (error instanceof PdfDocumentError) throw error
    throw new PdfDocumentError('No se pudo preparar el PDF para lectura visual. Puedes rellenarlo manualmente.', 'PDF_RENDER_FAILED')
  } finally { await parser.destroy().catch(() => {}) }
}

export async function prepareDocumentContent(file, { forceVision = false } = {}) {
  if (file.mimetype !== 'application/pdf') return {
    mode: 'vision', pageCount: 1,
    parts: [{ type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` } }],
  }
  const inspection = await inspectPdf(file)
  if (!forceVision && !inspection.needsVision) return {
    mode: 'text', pageCount: inspection.pageCount,
    parts: [{ type: 'text', text: `<documento_pdf>\n${inspection.text}\n</documento_pdf>` }],
  }
  const pages = await renderPdfPages(file)
  return {
    mode: 'vision', pageCount: inspection.pageCount,
    parts: pages.flatMap(page => [
      { type: 'text', text: `Página ${page.pageNumber} de ${inspection.pageCount}. Lee todos los importes, tablas y condiciones visibles.` },
      { type: 'image_url', image_url: { url: page.dataUrl } },
    ]),
  }
}
