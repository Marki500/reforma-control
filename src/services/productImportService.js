import { authenticatedGet, authenticatedRequest } from './uploadService.js'
import { safeImportDiagnostic, safeImportEvent } from '../utils/productImportDiagnostics.js'

// Polling reads an existing job. It never restarts a potentially chargeable scrape.
export async function importProduct(url, { onDiagnostic = () => {} } = {}) {
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const startedAt = Date.now()
  let report = { client_version: 5, request_id: requestId, phase: 'starting', events: [] }
  function publish(server, extra = {}) {
    report = safeImportDiagnostic({ ...report, ...safeImportDiagnostic(server || {}), ...extra })
    onDiagnostic(report)
  }
  function reportFailure(error, phase) {
    const server = safeImportDiagnostic(error.diagnostic || {})
    const events = server.events || report.events || []
    publish(server, {
      phase, http_status: error.responseStatus ?? error.status, api_json: error.apiJson === true,
      poll_request_id: error.requestId,
      events: [...events, safeImportEvent({ atMs: Date.now() - startedAt, phase, code: error.code, failureStatus: error.status })],
    })
  }
  publish()
  let job
  try {
    job = await authenticatedRequest('/api/import-product', JSON.stringify({ url, async: true }), { 'Content-Type': 'application/json', 'x-request-id': requestId })
  } catch (error) {
    reportFailure(error, 'error')
    throw error
  }
  publish(job.diagnostic, { request_id: job.request_id || requestId, phase: job.job_id ? 'polling' : 'complete' })
  if (!job.job_id) return job // Compatibility with an older backend during deployment.
  if (!job.poll_token) throw new Error('El servidor no devolvió una importación válida.')
  const deadline = Date.now() + 5 * 60 * 1000
  let transientFailures = 0
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    try {
      const result = await authenticatedGet(`/api/import-product/${encodeURIComponent(job.job_id)}`, { 'x-product-import-token': job.poll_token })
      publish(result.diagnostic, { phase: result.status === 'complete' ? 'complete' : 'polling' })
      transientFailures = 0
      if (result.status === 'error') {
        const code = result.code || 'PRODUCT_IMPORT_FAILED'
        const requestId = result.request_id || job.request_id
        const error = new Error(`${result.error || 'No se pudo importar el producto.'} · ${code} · Diagnóstico: ${requestId}`)
        Object.assign(error, { code, status: result.http_status, responseStatus: 200, requestId, diagnostic: result.diagnostic, apiJson: true })
        throw error
      }
      if (result.status === 'complete' && result.product) return result.product
      if (result.status !== 'processing') {
        const error = new Error('El servidor devolvió un estado de importación inesperado.')
        error.code = 'PRODUCT_IMPORT_INVALID_STATE'
        throw error
      }
    } catch (error) {
      if (!error.code && (!error.status || error.status >= 500) && ++transientFailures <= 3) {
        reportFailure(error, 'reconnecting')
        continue
      }
      reportFailure(error, 'error')
      throw error
    }
  }
  const error = new Error(`La importación ha superado el tiempo de espera. Diagnóstico: ${job.request_id || job.job_id}`)
  reportFailure(error, 'error')
  throw error
}
