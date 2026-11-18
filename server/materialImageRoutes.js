import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { materialImageLimit, optimizeMaterialImage, downloadMaterialImage, MaterialImageError } from './materialImages.js'

// The user's token is forwarded to Storage and PostgREST, preserving RLS.
export function registerMaterialImageRoutes(app, { requireSession, getRequestProjectId, supabaseUrl, supabaseKey }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: materialImageLimit, files: 1, fields: 0 } })
  const publicBase = `${supabaseUrl}/storage/v1/object/public/material-images/`
  const activeUsers = new Set()
  const headersFor = req => ({ Authorization: req.uploadAuthorization, apikey: supabaseKey })
  const optimized = (url, projectId) => typeof url === 'string' && url.startsWith(`${publicBase}${projectId}/optimized/`) && /^[0-9a-f-]+\.webp$/.test(url.slice(`${publicBase}${projectId}/optimized/`.length))

  async function store(req, source) {
    const result = await optimizeMaterialImage(source)
    const key = `${await getRequestProjectId(req)}/optimized/${randomUUID()}.webp`
    const response = await fetch(`${supabaseUrl}/storage/v1/object/material-images/${key}`, {
      method: 'POST', headers: { ...headersFor(req), 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000', 'x-upsert': 'false' },
      body: result.data, signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new MaterialImageError('No se pudo guardar la imagen optimizada en el almacenamiento.', 502)
    return { url: `${publicBase}${key}`, size: result.size, original_size: result.originalSize, width: result.width, height: result.height }
  }

  function limited(handler) {
    return async (req, res) => {
      const id = req.authUser.id
      if (activeUsers.has(id) || activeUsers.size >= 2) return res.status(429).json({ error: 'Hay imágenes procesándose. Espera unos segundos e inténtalo de nuevo.' })
      activeUsers.add(id)
      try { await handler(req, res) }
      catch (error) {
        res.status(error.status || 502).json({ error: error.status ? error.message : 'No se pudo optimizar la imagen. Inténtalo de nuevo.', request_id: req.requestId })
      } finally { activeUsers.delete(id) }
    }
  }

  app.post('/api/material-images', requireSession, upload.single('file'), limited(async (req, res) => {
    const projectId = await getRequestProjectId(req)
    if (!req.file && optimized(req.body?.url, projectId)) return res.json({ url: req.body.url, reused: true })
    const source = req.file?.buffer || await downloadMaterialImage(req.body?.url)
    res.json(await store(req, source))
  }))

  // Convert an existing material only if its image has not changed meanwhile.
  app.post('/api/materials/:id/optimize-image', requireSession, limited(async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) throw new MaterialImageError('El material no es válido.')
    const projectId = await getRequestProjectId(req)
    const query = `${supabaseUrl}/rest/v1/materials?id=eq.${req.params.id}&project_id=eq.${projectId}`
    const response = await fetch(`${query}&select=*,rooms(name),material_categories(name)`, { headers: headersFor(req), signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new MaterialImageError('No se pudo consultar el material.', 502)
    const [material] = await response.json()
    if (!material) throw new MaterialImageError('El material ya no está disponible en esta reforma.', 404)
    if (!material.main_image_url || optimized(material.main_image_url, projectId)) return res.json({ material, skipped: true })
    const result = await store(req, await downloadMaterialImage(material.main_image_url))
    // Never erase an old source: another material or project may still use it.
    const patch = await fetch(`${query}&main_image_url=eq.${encodeURIComponent(material.main_image_url)}&select=*,rooms(name),material_categories(name)`, {
      method: 'PATCH', headers: { ...headersFor(req), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ main_image_url: result.url }), signal: AbortSignal.timeout(15000),
    })
    // Keep the new object after an ambiguous write failure: the patch may have
    // committed even if the response was lost. Do not break a saved reference.
    if (!patch.ok) throw new MaterialImageError('No se pudo actualizar la imagen del material. El enlace anterior se conserva si no se guardó el cambio.', 502)
    const [saved] = await patch.json()
    if (!saved) throw new MaterialImageError('La imagen o el material han cambiado. Actualiza la lista antes de reintentarlo.', 409)
    res.json({ material: saved, ...result })
  }))
}
