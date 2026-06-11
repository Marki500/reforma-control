// Supabase Edge Function: import-product
// Extracts product data from a URL using JSON-LD, Open Graph, and meta tags

import { serve } from "https://deno.land/std@0.215.0/http/server.ts"

interface ProductData {
  name: string
  brand: string
  model: string
  price: number | null
  currency: string
  image: string
  storeName: string
  productUrl: string
  description: string
  availability: string
  rawData: Record<string, unknown>
}

serve(async (req) => {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const product: ProductData = {
      name: "",
      brand: "",
      model: "",
      price: null,
      currency: "EUR",
      image: "",
      storeName: "",
      productUrl: url,
      description: "",
      availability: "",
      rawData: {},
    }

    // 1. Extract JSON-LD
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    let match
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        const items = parsed["@graph"] || [parsed]
        for (const item of items) {
          if (
            item["@type"] === "Product" ||
            item["@type"]?.includes("Product")
          ) {
            product.name ||= item.name || ""
            product.brand ||= item.brand?.name || item.brand || ""
            product.model ||= item.model || ""
            product.price ||= item.offers?.price || item.offers?.[0]?.price || null
            product.currency ||=
              item.offers?.priceCurrency ||
              item.offers?.[0]?.priceCurrency ||
              "EUR"
            product.image ||=
              item.image?.url ||
              (Array.isArray(item.image) ? item.image[0] : item.image) ||
              ""
            product.description ||= item.description || ""
            product.availability ||= item.offers?.availability || ""
            product.rawData = { ...product.rawData, jsonLd: item }
          }
        }
      } catch {
        // skip invalid JSON-LD
      }
    }

    // 2. Extract Open Graph
    const ogRegex = /<meta[^>]*property="og:([^"]+)"[^>]*content="([^"]*)"[^>]*>/gi
    let ogMatch
    const og: Record<string, string> = {}
    while ((ogMatch = ogRegex.exec(html)) !== null) {
      og[ogMatch[1]] = ogMatch[2]
    }
    // Also match with content before property
    const ogRegex2 = /<meta[^>]*content="([^"]*)"[^>]*property="og:([^"]+)"[^>]*>/gi
    while ((ogMatch = ogRegex2.exec(html)) !== null) {
      og[ogMatch[2]] = ogMatch[1]
    }

    product.name ||= og.title || ""
    product.description ||= og.description || ""
    product.image ||= og.image || ""
    product.rawData = { ...product.rawData, openGraph: og }

    // 3. Extract meta tags
    const metaRegex = /<meta[^>]*name="([^"]+)"[^>]*content="([^"]*)"[^>]*>/gi
    let metaMatch
    const meta: Record<string, string> = {}
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      meta[metaMatch[1]] = metaMatch[2]
    }

    product.name ||= meta["product:title"] || meta["title"] || ""
    product.description ||= meta["description"] || meta["product:description"] || ""
    product.image ||= meta["product:image"] || meta["twitter:image"] || ""
    product.brand ||= meta["product:brand"] || meta["brand"] || ""
    product.price ||= meta["product:price"] ? Number(meta["product:price"]) : null
    product.currency ||= meta["product:price:currency"] || "EUR"
    product.availability ||= meta["product:availability"] || meta["availability"] || ""
    product.rawData = { ...product.rawData, meta }

    // 4. Extract from HTML as fallback
    if (!product.name) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      product.name = titleMatch?.[1]?.trim() || ""
    }

    if (!product.image) {
      const imgMatch = html.match(
        /<meta[^>]*itemprop="image"[^>]*content="([^"]*)"[^>]*>/i
      )
      product.image = imgMatch?.[1] || ""
    }

    // Extract domain as store name fallback
    if (!product.storeName) {
      try {
        product.storeName = new URL(url).hostname.replace("www.", "")
      } catch {}
    }

    // Clean up price
    if (product.price !== null && typeof product.price === "string") {
      product.price = Number(String(product.price).replace(/[^0-9.,]/g, "").replace(",", "."))
    }
    if (product.price !== null && isNaN(product.price)) {
      product.price = null
    }

    return new Response(JSON.stringify(product), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to extract product data",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
