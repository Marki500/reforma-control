import sharp from 'sharp'
import { fetchRemote } from './remoteFetch.js'

export const materialImageLimit = 12 * 1024 * 1024

export class MaterialImageError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

export async function optimizeMaterialImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > materialImageLimit) {
    throw new MaterialImageError('La imagen debe ocupar entre 1 byte y 12 MB.', 413)
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 40000000, pages: 1, failOn: 'error' })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp', 'heif', 'avif', 'gif'].includes(metadata.format)) {
      throw new MaterialImageError('Usa una imagen JPG, PNG, WebP, AVIF o GIF.', 415)
    }
    const { data, info } = await image.rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 }).timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height, originalSize: buffer.length, size: data.length }
  } catch (error) {
    if (error instanceof MaterialImageError) throw error
    throw new MaterialImageError('No se pudo procesar la imagen. Revisa el archivo o usa otra imagen JPG, PNG, WebP o AVIF.', 415)
  }
}

export async function downloadMaterialImage(url) {
  if (typeof url !== 'string' || url.length > 8192) throw new MaterialImageError('La URL de la imagen no es válida.')
  const result = await fetchRemote(url, {
    useNativeFetch: true, maxBytes: materialImageLimit, timeoutMs: 15000,
    allowedContentTypes: ['image'],
    headers: { Accept: 'image/avif,image/webp,image/*', 'User-Agent': 'Mozilla/5.0' },
  })
  return result.body
}
