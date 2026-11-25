import { authenticatedGet, authenticatedRequest } from './uploadService.js'

// Polling reads an existing job. It never restarts a potentially chargeable scrape.
export async function importProduct(url) {
  const job = await authenticatedRequest('/api/import-product', JSON.stringify({ url, async: true }), { 'Content-Type': 'application/json' })
  if (!job.job_id) return job // Compatibility with an older backend during deployment.
  if (!job.poll_token) throw new Error('El servidor no devolvió una importación válida.')
  const deadline = Date.now() + 5 * 60 * 1000
  let transientFailures = 0
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    try {
      const result = await authenticatedGet(`/api/import-product/${encodeURIComponent(job.job_id)}`, { 'x-product-import-token': job.poll_token })
      transientFailures = 0
      if (result.status === 'complete' && result.product) return result.product
      if (result.status !== 'processing') {
        const error = new Error('El servidor devolvió un estado de importación inesperado.')
        error.code = 'PRODUCT_IMPORT_INVALID_STATE'
        throw error
      }
    } catch (error) {
      if (!error.code && (!error.status || error.status >= 500) && ++transientFailures <= 3) continue
      throw error
    }
  }
  throw new Error(`La importación ha superado el tiempo de espera. Diagnóstico: ${job.request_id || job.job_id}`)
}
