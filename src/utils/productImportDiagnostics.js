const choices = {
  transport: ['native-fetch-pinned', 'node-http-pinned', 'zenrows'],
  phase: ['starting', 'queued', 'dns', 'request', 'fallback', 'response', 'result', 'content-type', 'polling', 'reconnecting', 'complete', 'error'],
  protection: ['DataDome', 'Cloudflare', 'HUMAN', 'Akamai/Imperva'],
}

// An allowlist keeps response bodies, URLs, cookies and all tokens out of the
// browser report, even when an upstream diagnostic gains new fields later.
export function safeImportEvent(value = {}) {
  if (!value || typeof value !== 'object') return {}
  const event = {}
  for (const key of ['atMs', 'elapsedMs', 'upstreamStatus', 'bytes', 'failureStatus']) {
    if (Number.isFinite(value[key]) && value[key] >= 0) event[key] = value[key]
  }
  for (const [key, allowed] of Object.entries(choices)) if (allowed.includes(value[key])) event[key] = value[key]
  for (const key of ['hasProduct', 'hasPrice']) if (typeof value[key] === 'boolean') event[key] = value[key]
  if (/^[\w.+-]+\/[\w.+-]+$/.test(value.contentType || '')) event.contentType = value.contentType.slice(0, 80)
  if (/^(?:[A-Z][A-Z0-9_]{1,79}|TimeoutError|AbortError|TypeError)$/.test(value.networkCode || '')) event.networkCode = value.networkCode
  if (/^(?:PRODUCT_[A-Z_]{1,64}|STORE_ACCESS_DENIED)$/.test(value.code || '')) event.code = value.code
  return event
}

export function safeImportDiagnostic(value = {}) {
  if (!value || typeof value !== 'object') return {}
  const diagnostic = {}
  for (const key of ['client_version', 'importer_version', 'elapsed_ms', 'http_status']) {
    if (Number.isFinite(value[key]) && value[key] >= 0) diagnostic[key] = value[key]
  }
  for (const key of ['request_id', 'poll_request_id']) {
    if (/^[a-zA-Z0-9_-]{8,80}$/.test(value[key] || '')) diagnostic[key] = value[key]
  }
  if (choices.phase.includes(value.phase)) diagnostic.phase = value.phase
  if (typeof value.api_json === 'boolean') diagnostic.api_json = value.api_json
  if (Array.isArray(value.events)) diagnostic.events = value.events.slice(-32).map(safeImportEvent)
  return diagnostic
}
