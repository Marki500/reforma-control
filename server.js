import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { randomUUID } from 'node:crypto'
import * as cheerio from 'cheerio'
import multer from 'multer'
import { fetchRemote, normalizeRemoteUrl, RemoteFetchError } from './server/remoteFetch.js'
import { budgetAnalysisPrompt, budgetAnalysisSchema, sanitizeBudgetAnalysis } from './server/budgetAnalysis.js'
import { renderProjectComment, renderProjectInvitation, sendMailjetEmail } from './server/mailjet.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, 'uploads')

// Ensure uploads directory exists
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {})

const app = express()
app.use(cors())
app.use(express.json())
app.use((req, res, next) => {
  const incomingId = req.get('x-request-id')
  req.requestId = /^[a-zA-Z0-9_-]{8,80}$/.test(incomingId || '') ? incomingId : randomUUID()
  res.set('x-request-id', req.requestId)
  next()
})


const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://api-reforma.noxumlab.com').replace(/\/$/, '')
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const geminiApiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
const aiModel = process.env.AI_MODEL || 'gemini-3.8-flash'
const aiFallbackModels = [...new Set([aiModel, 'gemini-3.8-flash', 'gemini-3.6-flash'])]
const aiProvider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase()
const openRouterApiKey = process.env.OPENROUTER_API_KEY || ''
const openRouterApiBaseUrl = (process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const openRouterModel = process.env.OPENROUTER_MODEL || 'openrouter/free'
const openRouterPdfEngine = process.env.OPENROUTER_PDF_ENGINE || 'pdf-text'
const aiRequestTimes = new Map()
const aiAnalysisJobs = new Map()
const mailjetApiKey = process.env.MAILJET_API_KEY || ''
const mailjetSecretKey = process.env.MAILJET_SECRET_KEY || ''
const mailFromEmail = process.env.MAIL_FROM_EMAIL || 'notificaciones@noxumlab.com'
const mailFromName = process.env.MAIL_FROM_NAME || 'NIVEL'
const appPublicUrl = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '')
const invitationEmailTimes = new Map()
const commentEmailTimes = new Map()

async function requireSession(req, res, next) {
  const authorization = req.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Inicia sesión para realizar esta operación.' })
  if (!supabaseKey) return res.status(503).json({ error: 'Falta configurar la clave pública de Supabase en el servidor.' })
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: supabaseKey },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return res.status(response.status === 401 || response.status === 403 ? 401 : 502).json({ error: 'No se pudo validar la sesión. Inicia sesión de nuevo o inténtalo más tarde.' })
    const user = await response.json()
    if (!user.id) return res.status(401).json({ error: 'Sesión no válida.' })
    req.uploadAuthorization = authorization
    req.authUser = user
    next()
  } catch {
    res.status(502).json({ error: 'No se pudo conectar con Supabase. Comprueba la configuración del servidor.' })
  }
}

async function getRequestProjectId(req) {
  if (req.projectId) return req.projectId
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/current_project_id`, {
    method: 'POST',
    headers: { Authorization: req.uploadAuthorization, apikey: supabaseKey, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('No se pudo identificar el proyecto compartido.')
  const projectId = await response.json()
  if (!/^[0-9a-f-]{36}$/i.test(projectId || '')) throw new Error('El proyecto compartido no es válido.')
  req.projectId = projectId
  return projectId
}

// Health check for Coolify / load balancers
app.get('/api/health', (_req, res) => {
  const configured = aiProvider === 'openrouter' ? Boolean(openRouterApiKey) : aiProvider === 'gemini' && Boolean(geminiApiKey)
  res.status(200).json({
    status: 'ok',
    release: 'accounts-projects-collaboration-v1',
    features: { ai_budget_async: 4, project_invitation_email: 1, project_comments: 1 },
    ai: { provider: aiProvider, model: aiProvider === 'openrouter' ? openRouterModel : aiModel, configured },
    mail: { provider: 'mailjet', configured: Boolean(mailjetApiKey && mailjetSecretKey && appPublicUrl) },
  })
})

app.post('/api/send-project-invitation', requireSession, async (req, res) => {
  const token = String(req.body?.token || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return res.status(400).json({ error: 'La invitación no es válida.', code: 'INVALID_INVITATION', request_id: req.requestId })
  }
  if (!mailjetApiKey || !mailjetSecretKey || !appPublicUrl) {
    return res.status(503).json({ error: 'El envío automático todavía no está configurado en el servidor.', code: 'MAIL_NOT_CONFIGURED', request_id: req.requestId })
  }
  const lastSentAt = invitationEmailTimes.get(req.authUser.id) || 0
  if (Date.now() - lastSentAt < 5000) {
    return res.status(429).json({ error: 'Espera unos segundos antes de enviar otra invitación.', code: 'MAIL_RATE_LIMIT', request_id: req.requestId })
  }

  try {
    const projectId = await getRequestProjectId(req)
    const headers = { Authorization: req.uploadAuthorization, apikey: supabaseKey, 'Content-Type': 'application/json' }
    const invitationResponse = await fetch(`${supabaseUrl}/rest/v1/project_invitations?select=email,expires_at&token=eq.${encodeURIComponent(token)}&project_id=eq.${projectId}&accepted_at=is.null&limit=1`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })
    const invitations = await invitationResponse.json().catch(() => [])
    if (!invitationResponse.ok) throw new Error('No se pudo comprobar la invitación.')
    const invitation = invitations?.[0]
    if (!invitation || new Date(invitation.expires_at) <= new Date()) {
      return res.status(404).json({ error: 'La invitación no existe o ha caducado.', code: 'INVITATION_NOT_FOUND', request_id: req.requestId })
    }

    const contextResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_workspace_context`, {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000),
    })
    const contexts = await contextResponse.json().catch(() => [])
    if (!contextResponse.ok || !contexts?.[0]) throw new Error('No se pudo identificar la reforma.')
    const context = contexts[0]
    const inviteUrl = `${appPublicUrl}/invite/${token}`
    const message = renderProjectInvitation({
      projectName: context.project_name || 'Mi reforma',
      inviterEmail: req.authUser.email || 'Una persona',
      inviteUrl,
    })
    invitationEmailTimes.set(req.authUser.id, Date.now())
    await sendMailjetEmail({
      apiKey: mailjetApiKey,
      secretKey: mailjetSecretKey,
      fromEmail: mailFromEmail,
      fromName: mailFromName,
      toEmail: invitation.email,
      requestId: req.requestId,
      ...message,
    })
    return res.json({ sent: true, email: invitation.email, request_id: req.requestId })
  } catch (error) {
    console.error('[project invitation email:error]', { requestId: req.requestId, userId: req.authUser.id, message: error?.message || 'Unknown error' })
    return res.status(502).json({ error: 'La invitación se creó, pero Mailjet no pudo enviar el correo.', code: 'MAIL_SEND_FAILED', request_id: req.requestId })
  }
})

app.post('/api/send-comment-notifications', requireSession, async (req, res) => {
  const commentId = String(req.body?.comment_id || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commentId)) return res.status(400).json({ error: 'El comentario no es válido.', code: 'INVALID_COMMENT', request_id: req.requestId })
  if (!mailjetApiKey || !mailjetSecretKey || !appPublicUrl) return res.status(503).json({ error: 'El envío de correo no está configurado.', code: 'MAIL_NOT_CONFIGURED', request_id: req.requestId })
  const lastSentAt = commentEmailTimes.get(req.authUser.id) || 0
  if (Date.now() - lastSentAt < 2500) return res.status(429).json({ error: 'Espera unos segundos antes de enviar otro aviso.', code: 'MAIL_RATE_LIMIT', request_id: req.requestId })
  try {
    const headers = { Authorization: req.uploadAuthorization, apikey: supabaseKey, 'Content-Type': 'application/json' }
    const [commentResponse, contextResponse, recipientsResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/project_comments?select=body&id=eq.${commentId}&author_id=eq.${req.authUser.id}&limit=1`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${supabaseUrl}/rest/v1/rpc/get_workspace_context`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000) }),
      fetch(`${supabaseUrl}/rest/v1/rpc/get_comment_notification_recipients`, { method: 'POST', headers, body: JSON.stringify({ p_comment_id: commentId }), signal: AbortSignal.timeout(15000) }),
    ])
    const [comments, contexts, recipients] = await Promise.all([commentResponse.json(), contextResponse.json(), recipientsResponse.json()])
    if (!commentResponse.ok || !contextResponse.ok || !recipientsResponse.ok || !comments?.[0] || !contexts?.[0]) throw new Error('No se pudo comprobar el comentario.')
    commentEmailTimes.set(req.authUser.id, Date.now())
    await Promise.all((recipients || []).map(recipient => sendMailjetEmail({
      apiKey: mailjetApiKey, secretKey: mailjetSecretKey, fromEmail: mailFromEmail, fromName: mailFromName,
      toEmail: recipient.email, requestId: req.requestId, customId: 'comment',
      ...renderProjectComment({ projectName: contexts[0].project_name || 'Mi reforma', authorEmail: req.authUser.email || 'Una persona', comment: comments[0].body, appUrl: appPublicUrl, mentioned: recipient.mentioned }),
    })))
    return res.json({ sent: recipients?.length || 0, request_id: req.requestId })
  } catch (error) {
    console.error('[project comment email:error]', { requestId: req.requestId, userId: req.authUser.id, message: error?.message || 'Unknown error' })
    return res.status(502).json({ error: 'El comentario se guardó, pero no se pudieron enviar los avisos.', code: 'MAIL_SEND_FAILED', request_id: req.requestId })
  }
})

app.post('/api/import-product', requireSession, async (req, res) => {
  const url = normalizeRemoteUrl(req.body?.url)

  if (!url) {
    return res.status(400).json({ error: 'URL requerida' })
  }

  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  try {
    const response = await fetchRemote(url, {
      maxBytes: 5 * 1024 * 1024,
      timeoutMs: 15000,
      allowedContentTypes: ['text/html', 'application/xhtml+xml'],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    })

    const html = response.body.toString('utf8')
    const $ = cheerio.load(html)
    const hostname = new URL(url).hostname.replace('www.', '')

    const product = {
      name: '',
      brand: '',
      model: '',
      price: null,
      currency: 'EUR',
      image: '',
      storeName: hostname,
      productUrl: url,
      description: '',
      availability: '',
    }

    // --- Helper: parse a price string to number (handles ES and EN formats) ---
    function parsePrice(val) {
      if (val === null || val === undefined || val === '') return null
      let s = String(val).replace(/[^0-9.,\-]/g, '')
      if (s === '') return null
      // Spanish format: 1.965,04 → remove dots, swap comma for dot
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.')
      } else {
        s = s.replace(/,/g, '')
      }
      const n = Number(s)
      return isNaN(n) ? null : n
    }

    // --- Store-specific rules (easy to extend) ---
    const storeRules = {
      'climamarket.es': { price: '.climamarket-price' },
      'leroymerlin.es': { price: '.big-price' },
      'amazon.es': { price: '.a-price-whole', name: '#productTitle' },
      'amazon.com': { price: '.a-price-whole', name: '#productTitle' },
    }

    const rules = storeRules[hostname] || {}

    // 1. JSON-LD (structured data, most reliable)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text())
        const items = data['@graph'] || [data]
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type']?.includes('Product')) {
            product.name ||= item.name || ''
            product.brand ||= item.brand?.name || item.brand || ''
            product.model ||= item.model || ''
            product.price ??= parsePrice(item.offers?.price ?? item.offers?.[0]?.price)
            product.currency ||= item.offers?.priceCurrency || item.offers?.[0]?.priceCurrency || 'EUR'
            product.image ||= item.image?.url || (Array.isArray(item.image) ? item.image[0] : item.image) || ''
            product.description ||= item.description || ''
            product.availability ||= item.offers?.availability || ''
          }
        }
      } catch {}
    })

    // 2. Open Graph
    $('meta[property^="og:"]').each((_, el) => {
      const prop = $(el).attr('property')
      const content = $(el).attr('content')
      if (prop === 'og:title') product.name ||= content || ''
      if (prop === 'og:description') product.description ||= content || ''
      if (prop === 'og:image') product.image ||= content || ''
    })

    // 3. Meta tags
    $('meta[name]').each((_, el) => {
      const name = $(el).attr('name')
      const content = $(el).attr('content')
      if (name === 'description') product.description ||= content || ''
      if (name === 'product:brand' || name === 'brand') product.brand ||= content || ''
      if (name === 'product:price:amount') product.price ??= parsePrice(content)
      if (name === 'product:price:currency') product.currency ||= content || 'EUR'
      if (name === 'twitter:image') product.image ||= content || ''
    })

    // 4. Store-specific selectors
    if (!product.name && rules.name) {
      product.name = $(rules.name).first().text().trim() || ''
    }
    if (product.price === null && rules.price) {
      const el = $(rules.price).first()
      const val = parsePrice(el.attr('content') || el.text())
      if (val !== null && val > 1) product.price = val
    }

    // 5. Microdata itemprop
    if (product.price === null) {
      product.price = parsePrice($('meta[itemprop="price"]').attr('content'))
    }
    if (product.price === null) {
      product.price = parsePrice($('[itemprop="price"]').first().attr('content'))
    }

    // 6. Common CSS price selectors (iterate until one works)
    if (product.price === null) {
      const selectors = [
        '.current-price .price',
        '.product-price',
        '[data-price]',
        '.price .amount',
        '.precio',
        '#our_price_display',
        '.price_sale',
        '.price-percent-reduction',
      ]
      for (const sel of selectors) {
        const text = $(sel).first().text().trim()
        const val = parsePrice(text)
        if (val !== null && val > 1) { product.price = val; break }
      }
    }

    // 7. Regex fallback on raw HTML (last resort)
    if (product.price === null) {
      const patterns = [
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$€]/,
        /[€$€]\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/,
        /precio[^0-9]*?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
      ]
      for (const pat of patterns) {
        const m = html.match(pat)
        if (m) {
          const val = parsePrice(m[1])
          if (val !== null && val > 1) { product.price = val; break }
        }
      }
    }

    // 8. Brand from meta or URL
    if (!product.brand) {
      product.brand = $('meta[property="product:brand"]').attr('content') || ''
    }

    // 9. Name fallback
    if (!product.name) {
      product.name = $('h1').first().text().trim() || $('title').first().text().trim() || ''
      // Clean up title suffix
      product.name = product.name.replace(/\s*[|]\s*.*$/, '').trim()
    }

    // 10. Image fallback
    if (!product.image) {
      product.image = $('meta[itemprop="image"]').attr('content') || ''
    }
    if (!product.image) {
      const firstImg = $('img[src*="/"]').first()
      const src = firstImg.attr('src') || firstImg.attr('data-src') || ''
      if (src && !src.includes('logo') && !src.includes('icon')) {
        product.image = src.startsWith('http') ? src : new URL(src, url).href
      }
    }

    // Ensure price is a number or null
    product.price = product.price !== null ? Number(product.price) : null

    res.json(product)
  } catch (error) {
    res.status(error instanceof RemoteFetchError ? error.status : 500).json({
      error: error instanceof Error ? error.message : 'Error al extraer datos',
    })
  }
})

app.post('/api/extract-inspiration', requireSession, async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL requerida' })

  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  try {
    // Pinterest → use widget API (scraping requires login)
    const hostname = new URL(url).hostname.replace('www.', '')
    if (hostname.endsWith('pinterest.com') || hostname.endsWith('pinterest.es') || hostname === 'pin.it') {
      const pinMatch = url.match(/pin\/(\d+)/)
      if (pinMatch) {
        const pinId = pinMatch[1]
        const widgetUrl = `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`
        const widgetRes = await fetchRemote(widgetUrl, {
          maxBytes: 512 * 1024,
          timeoutMs: 8000,
          allowedContentTypes: ['application/json'],
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (widgetRes.status >= 200 && widgetRes.status < 300) {
          const widgetData = JSON.parse(widgetRes.body.toString('utf8'))
          const pin = widgetData?.data?.[0]
          if (pin && pin.pinner) {
            const img = pin.images?.orig?.url || pin.images?.['236x']?.url || ''
            return res.json({
              title: pin.description || pin.title || '',
              image_url: img,
              source_url: url,
            })
          }
        }
      }
      // fallback → return empty so user fills manually
    }

    const response = await fetchRemote(url, {
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 10000,
      allowedContentTypes: ['text/html', 'application/xhtml+xml'],
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    const html = response.body.toString('utf8')
    const $ = cheerio.load(html)

    let title = ''
    let image_url = ''

    // Title: OG → h1 → title
    title = $('meta[property="og:title"]').attr('content')
      || $('h1').first().text().trim()
      || $('title').first().text().trim()
      || ''

    // Image: OG → meta → first large image
    image_url = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || $('meta[itemprop="image"]').attr('content')
      || ''

    if (!image_url) {
      const firstImg = $('img[src*="/"]').first()
      const src = firstImg.attr('src') || firstImg.attr('data-src') || ''
      if (src && !src.includes('logo') && !src.includes('icon')) {
        image_url = src.startsWith('http') ? src : new URL(src, url).href
      }
    }

    // Clean title
    title = title.replace(/\s*[|]\s*.*$/, '').trim()

    res.json({ title, image_url, source_url: url })
  } catch (error) {
    res.status(error instanceof RemoteFetchError ? error.status : 500).json({
      error: error instanceof Error ? error.message : 'Error al extraer datos',
    })
  }
})

app.post('/api/upload-image', requireSession, async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL requerida' })

  try {
    const response = await fetchRemote(url, {
      maxBytes: 5 * 1024 * 1024,
      timeoutMs: 10000,
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const buffer = response.body
    const contentType = response.contentType
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' }[contentType] || '.jpg'

    const fileName = `inspirations/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const storageUrl = `${supabaseUrl}/storage/v1/object/images/${fileName}`

    const uploadRes = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.uploadAuthorization,
        'apikey': supabaseKey,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(errText || `HTTP ${uploadRes.status}`)
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${fileName}`

    res.json({ url: publicUrl })
  } catch (error) {
    res.status(error instanceof RemoteFetchError ? error.status : 500).json({
      error: error instanceof Error ? error.message : 'Error al subir imagen',
    })
  }
})

// Multer config for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    cb(null, allowed.includes(file.mimetype))
  },
})

const pdfUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf']
    cb(null, allowed.includes(file.mimetype))
  },
})

const documentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
})

function getGenerateContentText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || []).map(part => part?.text || '').join('')
}

async function uploadGeminiFile(file) {
  const startResponse = await fetch(`${geminiApiBaseUrl}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ file: { display_name: 'budget.pdf' } }),
  })
  if (!startResponse.ok) {
    const payload = await startResponse.json().catch(() => ({}))
    const error = new Error(payload?.error?.message || `Gemini rechazó el inicio de la subida (HTTP ${startResponse.status}).`)
    error.status = startResponse.status
    throw error
  }
  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Gemini no devolvió una dirección para subir el PDF.')
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(file.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    signal: AbortSignal.timeout(45000),
    body: file.buffer,
  })
  const payload = await uploadResponse.json().catch(() => ({}))
  if (!uploadResponse.ok || !payload?.file?.uri) {
    const error = new Error(payload?.error?.message || `Gemini no pudo recibir el PDF (HTTP ${uploadResponse.status}).`)
    error.status = uploadResponse.status
    throw error
  }
  return payload.file
}

async function deleteGeminiFile(file) {
  if (!/^files\/[a-zA-Z0-9_-]+$/.test(file?.name || '')) return
  await fetch(`${geminiApiBaseUrl}/v1beta/${file.name}`, {
    method: 'DELETE',
    headers: { 'x-goog-api-key': geminiApiKey },
    signal: AbortSignal.timeout(10000),
  }).catch(() => {})
}

async function requestBudgetAnalysisWithModel(fileUri, model) {
  const response = await fetch(`${geminiApiBaseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      contents: [{ parts: [
        { file_data: { mime_type: 'application/pdf', file_uri: fileUri } },
        { text: `${budgetAnalysisPrompt}\nDevuelve exclusivamente un objeto JSON válido que cumpla este esquema: ${JSON.stringify(budgetAnalysisSchema)}` },
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 8192 },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Gemini respondió con HTTP ${response.status}.`)
    error.status = response.status
    throw error
  }

  const text = getGenerateContentText(payload)
  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (!jsonText) throw new Error('La IA no devolvió datos para este documento.')
  try {
    return { draft: sanitizeBudgetAnalysis(JSON.parse(jsonText)), model }
  } catch {
    throw new Error('La IA devolvió una respuesta que no se pudo interpretar. Inténtalo de nuevo.')
  }
}

async function requestBudgetAnalysis(file) {
  const uploadedFile = await uploadGeminiFile(file)
  try {
    let lastError
    for (const model of aiFallbackModels) {
      try {
        return await requestBudgetAnalysisWithModel(uploadedFile.uri, model)
      } catch (error) {
        lastError = error
        if (error?.status !== 404) throw error
      }
    }
    lastError.triedModels = aiFallbackModels
    throw lastError
  } finally {
    await deleteGeminiFile(uploadedFile)
  }
}

function getOpenRouterText(payload) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(part => part?.text || '').join('')
  return ''
}

async function requestOpenRouterBudgetAnalysis(file) {
  const fileData = `data:application/pdf;base64,${file.buffer.toString('base64')}`
  const response = await fetch(`${openRouterApiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://nivel.app',
      'X-Title': 'NIVEL',
    },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: openRouterModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${budgetAnalysisPrompt}\nDevuelve exclusivamente un objeto JSON valido que cumpla este esquema: ${JSON.stringify(budgetAnalysisSchema)}` },
          { type: 'file', file: { filename: file.originalname || 'presupuesto.pdf', file_data: fileData } },
        ],
      }],
      plugins: [{ id: 'file-parser', pdf: { engine: openRouterPdfEngine } }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8192,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `OpenRouter respondió con HTTP ${response.status}.`)
    error.status = response.status
    throw error
  }
  const text = getOpenRouterText(payload)
  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (!jsonText) throw new Error('La IA no devolvió datos para este documento.')
  try {
    return { draft: sanitizeBudgetAnalysis(JSON.parse(jsonText)), model: payload?.model || openRouterModel }
  } catch {
    throw new Error('La IA devolvió una respuesta que no se pudo interpretar. Inténtalo de nuevo.')
  }
}

function requestConfiguredBudgetAnalysis(file) {
  if (aiProvider === 'openrouter') return requestOpenRouterBudgetAnalysis(file)
  return requestBudgetAnalysis(file)
}

function classifyAIError(error) {
  const providerName = aiProvider === 'openrouter' ? 'OpenRouter' : 'Gemini'
  const message = error instanceof Error ? error.message : ''
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /timeout|timed out/i.test(message)) {
    return { status: 504, code: 'AI_TIMEOUT', message: 'La IA tardó demasiado en procesar el PDF.' }
  }
  if (error?.status === 429) return { status: 429, code: 'AI_RATE_LIMIT', message: `Se ha alcanzado temporalmente el límite gratuito de ${providerName}.` }
  if ([401, 403].includes(error?.status)) return { status: 503, code: 'AI_KEY_REJECTED', message: `${providerName} ha rechazado la clave API configurada.` }
  if (error?.status === 404) return { status: 503, code: 'AI_MODEL_NOT_FOUND', message: aiProvider === 'openrouter' ? `El modelo ${openRouterModel} no está disponible en OpenRouter.` : `Ninguno de los modelos configurados está disponible para esta clave (${(error.triedModels || [aiModel]).join(', ')}).` }
  if (error?.status === 400) return { status: 502, code: 'AI_REQUEST_REJECTED', message: `${providerName} ha rechazado el PDF o la configuración del modelo.` }
  if (/fetch failed|network|ENOTFOUND|ECONN/i.test(message)) return { status: 502, code: 'AI_CONNECTION', message: `El servidor no ha podido conectarse con ${providerName}.` }
  if (/no devolvió datos|no se pudo interpretar/i.test(message)) return { status: 502, code: 'AI_INVALID_RESPONSE', message }
  return { status: 502, code: 'AI_UNKNOWN', message: 'No se pudo completar el análisis con IA.' }
}

async function runBudgetAnalysisJob(jobId, file, diagnostic) {
  const startedAt = Date.now()
  console.info('[AI budget analysis:start]', { ...diagnostic, bytes: file.size })
  try {
    const { draft, model } = await requestConfiguredBudgetAnalysis(file)
    aiAnalysisJobs.set(jobId, { ...aiAnalysisJobs.get(jobId), status: 'complete', draft, model, provider: aiProvider })
    console.info('[AI budget analysis:success]', { ...diagnostic, selectedModel: model, durationMs: Date.now() - startedAt, lineItems: draft.line_items.length })
  } catch (error) {
    const classified = classifyAIError(error)
    aiAnalysisJobs.set(jobId, { ...aiAnalysisJobs.get(jobId), status: 'error', failure: classified })
    console.error('[AI budget analysis:error]', { ...diagnostic, durationMs: Date.now() - startedAt, code: classified.code, providerStatus: error?.status || null, providerMessage: error?.message || 'Unknown error' })
  }
}

app.post('/api/analyze-budget', requireSession, pdfUpload.single('file'), (req, res) => {
  const selectedModel = aiProvider === 'openrouter' ? openRouterModel : aiModel
  const diagnostic = { requestId: req.requestId, userId: req.authUser.id, provider: aiProvider, model: selectedModel }
  if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo PDF válido.', code: 'INVALID_PDF', request_id: req.requestId })
  if (!['gemini', 'openrouter'].includes(aiProvider)) return res.status(503).json({ error: `El proveedor de IA “${aiProvider}” no es válido. Usa gemini u openrouter.`, code: 'AI_PROVIDER_INVALID', request_id: req.requestId })
  if ((aiProvider === 'gemini' && !geminiApiKey) || (aiProvider === 'openrouter' && !openRouterApiKey)) return res.status(503).json({ error: `Falta configurar la clave de ${aiProvider === 'openrouter' ? 'OpenRouter' : 'Gemini'} en el servidor.`, code: 'AI_NOT_CONFIGURED', request_id: req.requestId })
  if (req.file.size > 14 * 1024 * 1024) return res.status(413).json({ error: 'Para analizarlo con IA, el PDF debe ocupar como máximo 14 MB.', code: 'PDF_TOO_LARGE', request_id: req.requestId })

  const userId = req.authUser.id
  const now = Date.now()
  if (now - (aiRequestTimes.get(userId) || 0) < 5000) {
    return res.status(429).json({ error: 'Espera unos segundos antes de volver a analizar otro documento.', code: 'LOCAL_RATE_LIMIT', request_id: req.requestId })
  }
  aiRequestTimes.set(userId, now)
  if (aiRequestTimes.size > 1000) {
    for (const [id, time] of aiRequestTimes) if (now - time > 60 * 60 * 1000) aiRequestTimes.delete(id)
  }

  const jobId = randomUUID()
  const pollToken = randomUUID()
  aiAnalysisJobs.set(jobId, { userId, pollToken, requestId: req.requestId, status: 'processing', createdAt: now })
  res.status(202).json({ status: 'processing', job_id: jobId, poll_token: pollToken, request_id: req.requestId })
  setImmediate(() => runBudgetAnalysisJob(jobId, req.file, diagnostic))
  const cleanup = setTimeout(() => aiAnalysisJobs.delete(jobId), 10 * 60 * 1000)
  cleanup.unref?.()
})

app.get('/api/analyze-budget/:jobId', (req, res) => {
  const job = aiAnalysisJobs.get(req.params.jobId)
  if (!job || job.pollToken !== req.get('x-analysis-token')) {
    return res.status(404).json({ error: 'El análisis ya no está disponible. Vuelve a enviar el PDF.', code: 'AI_JOB_NOT_FOUND', request_id: req.requestId })
  }
  if (job.status === 'processing') return res.status(202).json({ status: 'processing', request_id: job.requestId })
  if (job.status === 'error') return res.status(job.failure.status).json({ error: job.failure.message, code: job.failure.code, request_id: job.requestId })
  return res.json({ status: 'complete', draft: job.draft, provider: job.provider, model: job.model, request_id: job.requestId })
})

app.post('/api/upload-file', requireSession, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido o formato no válido' })

  try {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' }[req.file.mimetype] || '.jpg'
    const fileName = `inspirations/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/images/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': req.uploadAuthorization,
        'apikey': supabaseKey,
        'Content-Type': req.file.mimetype,
        'x-upsert': 'true',
      },
      body: req.file.buffer,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(errText || `HTTP ${uploadRes.status}`)
    }

    res.json({ url: `${supabaseUrl}/storage/v1/object/public/images/${fileName}` })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al subir archivo',
    })
  }
})

app.post('/api/upload-pdf', requireSession, pdfUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF requerido' })

  try {
    const fileName = `budget-pdfs/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/budget-pdfs/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': req.uploadAuthorization,
        'apikey': supabaseKey,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: req.file.buffer,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(errText || `HTTP ${uploadRes.status}`)
    }

    res.json({
      url: `${supabaseUrl}/storage/v1/object/public/budget-pdfs/${fileName}`,
      size: req.file.size,
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al subir PDF',
    })
  }
})

app.post('/api/upload-document', requireSession, documentUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Documento requerido o formato no válido' })
  try {
    const extensions = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
    const projectId = await getRequestProjectId(req)
    const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extensions[req.file.mimetype]}`
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/home-documents/${fileName}`, {
      method: 'POST',
      headers: { 'Authorization': req.uploadAuthorization, 'apikey': supabaseKey, 'Content-Type': req.file.mimetype, 'x-upsert': 'false' },
      body: req.file.buffer,
    })
    if (!uploadRes.ok) throw new Error(await uploadRes.text() || `HTTP ${uploadRes.status}`)
    res.json({ url: fileName, size: req.file.size })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error al subir el documento' })
  }
})

// Serve uploaded images (local fallback)
app.use('/uploads', express.static(uploadsDir))

// Serve built frontend in production
app.use((error, _req, res, next) => {
  if (!error) return next()
  const tooLarge = error.code === 'LIMIT_FILE_SIZE'
  res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'El archivo supera el tamaño permitido.' : 'No se pudo procesar el archivo.' })
})

const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (API: /api/import-product, /api/extract-inspiration, /api/upload-image)`)
})
