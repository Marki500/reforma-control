import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'public', 'icons')
mkdirSync(output, { recursive: true })

const palette = { ink: [37, 42, 35, 255], chalk: [244, 240, 231, 255], clay: [216, 109, 77, 255] }
const polygon = [[11, 35], [11, 13], [18.2, 13], [29.8, 26.4], [29.8, 13], [37, 13], [37, 35], [29.9, 35], [18.2, 21.5], [18.2, 35]]

function insidePolygon(x, y, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]; const [xj, yj] = points[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type)
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length, 0); name.copy(result, 4); data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8)
  return result
}

function createIcon(size, safeScale = 1) {
  const rows = Buffer.alloc((size * 4 + 1) * size)
  const samples = 3
  for (let py = 0; py < size; py += 1) {
    rows[py * (size * 4 + 1)] = 0
    for (let px = 0; px < size; px += 1) {
      const total = [0, 0, 0, 0]
      for (let sy = 0; sy < samples; sy += 1) for (let sx = 0; sx < samples; sx += 1) {
        const ux = ((px + (sx + 0.5) / samples) / size - 0.5) / safeScale + 0.5
        const uy = ((py + (sy + 0.5) / samples) / size - 0.5) / safeScale + 0.5
        const x = ux * 48; const y = uy * 48
        let color = palette.ink
        if (insidePolygon(x, y, polygon)) color = palette.chalk
        const distance = Math.hypot(x - 24, y - 24)
        if (distance <= 3.5) color = distance <= 2.7 ? palette.clay : palette.chalk
        for (let channel = 0; channel < 4; channel += 1) total[channel] += color[channel]
      }
      const offset = py * (size * 4 + 1) + 1 + px * 4
      for (let channel = 0; channel < 4; channel += 1) rows[offset + channel] = Math.round(total[channel] / (samples * samples))
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND')])
}

for (const [name, size, scale] of [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.72]]) {
  writeFileSync(resolve(output, name), createIcon(size, scale))
}

console.log('Generated NIVEL PWA icons in public/icons')
