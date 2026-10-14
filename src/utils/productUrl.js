export function normalizeProductUrl(value) {
  let url = String(value || '').trim()
  url = url.replace(/^['"<]+|['">]+$/g, '').replaceAll('\\', '')
  if (/^www\./i.test(url)) url = `https://${url}`
  return url
}
