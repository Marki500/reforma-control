import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import multer from 'multer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, 'uploads')

// Ensure uploads directory exists
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {})

const app = express()
app.use(cors())
app.use(express.json())

// Health check for Coolify / load balancers
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.post('/api/import-product', async (req, res) => {
  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL requerida' })
  }

  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1',
      },
    })

    if (!response.ok) {
      const msg = response.status === 403
        ? 'La tienda bloquea la extracción automática. Introduce los datos manualmente.'
        : `HTTP ${response.status}`
      throw new Error(msg)
    }

    const html = await response.text()
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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al extraer datos',
    })
  }
})

app.post('/api/extract-inspiration', async (req, res) => {
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
        const widgetRes = await fetch(widgetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (widgetRes.ok) {
          const widgetData = await widgetRes.json()
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

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al extraer datos',
    })
  }
})

app.post('/api/upload-image', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL requerida' })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' }[contentType] || '.jpg'

    if (contentType.includes('svg') || url.startsWith('data:')) {
      return res.json({ url })
    }

    const fileName = `inspirations/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const storageUrl = `https://api-reforma.bycram.dev/storage/v1/object/images/${fileName}`
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

    const uploadRes = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
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

    const publicUrl = `https://api-reforma.bycram.dev/storage/v1/object/public/images/${fileName}`

    res.json({ url: publicUrl })
  } catch (error) {
    res.status(500).json({
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

app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido o formato no válido' })

  try {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' }[req.file.mimetype] || '.jpg'
    const fileName = `inspirations/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

    const uploadRes = await fetch(`https://api-reforma.bycram.dev/storage/v1/object/images/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
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

    res.json({ url: `https://api-reforma.bycram.dev/storage/v1/object/public/images/${fileName}` })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al subir archivo',
    })
  }
})

// Serve uploaded images (local fallback)
app.use('/uploads', express.static(uploadsDir))

// Serve built frontend in production
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (API: /api/import-product, /api/extract-inspiration, /api/upload-image)`)
})
