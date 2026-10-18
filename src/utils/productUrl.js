export function normalizeProductUrl(value) {
  let url = String(value || '').trim()
  url = url.replace(/^['"<]+|['">]+$/g, '').replaceAll('\\', '')
  if (/^www\./i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    const trackingParameters = new Set([
      'awc', 'aw_affid', 'dclid', 'fbclid', 'gad_source', 'gclid',
      'sv1', 'sv_campaign_id', 'utm_id',
    ])
    for (const name of [...parsed.searchParams.keys()]) {
      if (name.toLowerCase().startsWith('utm_') || trackingParameters.has(name.toLowerCase())) {
        parsed.searchParams.delete(name)
      }
    }
    return parsed.href
  } catch {}
  return url
}
