import { createCanvas } from '@napi-rs/canvas'

// Synthetic documents only: no customer files or identifying information.
export function pdfFixture(modes = ['text']) {
  const objects = []
  const add = value => { objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value)); return objects.length }
  const stream = (dictionary, data) => Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, Buffer.from('\nendstream')])
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('')
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pages = []
  for (const mode of modes) {
    let resource = `/Font << /F1 ${font} 0 R >>`
    let commands = 'BT /F1 12 Tf 40 750 Td (PRESUPUESTO PRUEBA. Proveedor Taller Ejemplo. Referencia P-123.) Tj 0 -24 Td (Instalacion de material y mano de obra. Base 100 EUR IVA 21 EUR Total 121 EUR.) Tj ET'
    if (mode === 'scan') {
      const canvas = createCanvas(600, 800), ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 800)
      ctx.fillStyle = 'black'; ctx.font = '22px sans-serif'
      for (const [i, line] of ['PRESUPUESTO PRUEBA', 'Proveedor Taller Ejemplo', 'Instalacion de material', 'Base 100 EUR IVA 21 EUR', 'Total 121 EUR'].entries()) ctx.fillText(line, 30, 80 + i * 60)
      const image = add(stream('/Type /XObject /Subtype /Image /Width 600 /Height 800 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', canvas.toBuffer('image/jpeg')))
      resource = `/XObject << /Im1 ${image} 0 R >>`
      commands = 'q 600 0 0 800 0 0 cm /Im1 Do Q'
    }
    const content = add(stream('', Buffer.from(commands)))
    pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${resource} >> /Contents ${content} 0 R >>`))
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pages.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  const info = add('<< /Author (AUTOR_METADATA_NO_ES_PROVEEDOR) >>')
  const chunks = [Buffer.from('%PDF-1.4\n')], offsets = [0]
  let size = chunks[0].length
  for (const [i, object] of objects.entries()) {
    offsets.push(size)
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')])
    chunks.push(chunk); size += chunk.length
  }
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${size}\n%%EOF`))
  return Buffer.concat(chunks)
}
