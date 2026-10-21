import { pdfFixture } from './pdfFixtures.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'fixture-routes',
    configureServer(server) {
      const progressJobs = new Map()
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/fixture.pdf') { _response.setHeader('Content-Type', 'application/pdf'); _response.end(pdfFixture()); return }
        if (request.url === '/api/upload-pdf') { request.resume(); _response.setHeader('Content-Type', 'application/json'); _response.end(JSON.stringify({ url: 'http://127.0.0.1:4175/storage/v1/object/public/budget-pdfs/demo/example.pdf', size: 100 })); return }
        if (request.url?.startsWith('/api/')) {
          const draft = { is_invoice: true, is_budget: true, document_title: 'Carpintería y montaje de ventanas', supplier_name: 'Carpintería Sur', supplier_tax_id: 'B12345678', supplier_phone: '933123123', supplier_email: 'sur@example.com', supplier_address: 'Calle de ejemplo 1', invoice_number: 'F-2026-001', issued_date: '2026-10-19', due_date: '2026-11-01', currency: 'EUR', subtotal: 1000, tax_rate: 21, tax_amount: 210, total_amount: 1210, notes: '', warnings: [], line_items: [{ description: 'Ventanas y montaje', total: 1000 }] }
          let payload
          if (request.url === '/api/health') payload = { features: { ai_budget_async: 6, ai_invoice_async: 1 } }
          else if (request.url === '/api/ai-usage') payload = { allowed: true, user_used: 1, user_limit: 10, global_used: 3, global_limit: 40 }
          else if (['/api/analyze-invoice', '/api/analyze-budget'].includes(request.url)) {
            const previewProgress = request.headers.referer?.includes('progressPreview=1')
            const jobId = previewProgress ? `progress-job-${Date.now()}` : 'preview-job'
            if (previewProgress) progressJobs.set(jobId, Date.now())
            payload = { job_id: jobId, poll_token: 'preview-only', request_id: 'preview' }
          }
          else if (request.url.includes('/progress-job-')) {
            const elapsed = Date.now() - progressJobs.get(request.url.split('/').pop())
            payload = elapsed < 20000
              ? { status: 'processing', progress: elapsed < 4000 ? { stage: 'preparing' } : elapsed < 8000 ? { stage: 'rendering', page: 2, page_count: 3 } : { stage: 'analyzing' } }
              : { status: 'complete', draft, model: 'Simulación local' }
          }
          else if (request.url.includes('/preview-job')) payload = { status: 'complete', draft, model: 'Simulación local' }
          if (payload) { _response.setHeader('Content-Type', 'application/json'); _response.end(JSON.stringify(payload)); return }
        }
        if (/^\/(dashboard|materials|facturas|gastos|presupuestos|informes)(\?|$)/.test(request.url)) request.url = `/tests/ui-preview.html${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`
        next()
      })
    },
  }],
  resolve: { alias: [{ find: /^.*\/supabaseClient$/, replacement: fileURLToPath(new URL('./ui-preview-client.js', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
})
