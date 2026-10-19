import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'fixture-routes',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (/^\/(dashboard|materials)(\?|$)/.test(request.url)) request.url = `/tests/ui-preview.html${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`
        next()
      })
    },
  }],
  resolve: { alias: [{ find: /^.*\/supabaseClient$/, replacement: fileURLToPath(new URL('./ui-preview-client.js', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
})
