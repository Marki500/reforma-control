export async function measureRead(label, read, timings, now = () => performance.now()) {
  const started = now()
  try { return await read() }
  finally { timings[label] = Math.round(now() - started) }
}

// Share timing and failure data without URLs, query strings or session tokens.
export function materialsDiagnosticReport({ load, images = [], failures = [], resources = [], materialCount = 0, pageCount = 1, now = new Date() }) {
  const requests = []
  for (const entry of resources) {
    try {
      const url = new URL(entry.name)
      let resource
      if (entry.initiatorType === 'img') continue // Images are recorded by load/error events below.
      if (url.pathname.startsWith('/rest/v1/')) resource = `datos:${url.pathname.split('/').slice(3).join('/')}`
      else if (url.pathname.startsWith('/auth/v1/')) resource = 'sesión'
      else if (url.pathname.startsWith('/api/material')) resource = 'optimización'
      else if (url.pathname.startsWith('/assets/')) resource = 'archivo de la app'
      else continue
      requests.push({ resource, host: url.hostname, started_ms: Math.round(entry.startTime || 0), ms: Math.round(entry.duration), bytes: entry.encodedBodySize || null })
    } catch { /* Ignore malformed resource names. */ }
  }
  return {
    version: 1, captured_at: now.toISOString(),
    materials_loaded: materialCount, pages: pageCount, load,
    image_count: images.length,
    image_errors: images.filter(image => image.failed),
    slow_images: images.filter(image => !image.failed && image.ms >= 500).sort((a, b) => b.ms - a.ms).slice(0, 15),
    optimization_failures: failures,
    requests: requests.sort((a, b) => b.ms - a.ms).slice(0, 25),
    note: 'Los tiempos incluyen espera del navegador y de red; no equivalen al tiempo de la base de datos. Un tamaño nulo puede indicar caché o restricciones del navegador.',
  }
}

export function sampleFrames(durationMs = 1000) {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve({ supported: false })
  return new Promise(resolve => {
    const gaps = []
    let first, previous, frame, done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      resolve({ supported: true, frames: gaps.length, max_gap_ms: gaps.length ? Math.round(Math.max(...gaps)) : null,
        gaps_over_50ms: gaps.filter(gap => gap > 50).length })
    }
    const timer = setTimeout(finish, durationMs + 500)
    const tick = time => {
      if (first == null) first = time
      if (previous != null) gaps.push(time - previous)
      previous = time
      if (time - first >= durationMs) finish()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  })
}
