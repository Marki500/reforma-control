import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function LocalPdfPreview({ file }) {
  const [document, setDocument] = useState(null), [page, setPage] = useState(1), [zoom, setZoom] = useState(1), [width, setWidth] = useState(400), [error, setError] = useState(''), [rendering, setRendering] = useState(false)
  const container = useRef(), canvas = useRef()
  useEffect(() => {
    let active = true, loading
    setDocument(null); setPage(1); setZoom(1); setError('')
    file.arrayBuffer().then(buffer => {
      if (!active) return
      loading = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false })
      return loading.promise.then(pdf => { if (active) setDocument({ file, pdf }) })
    }).catch(() => { if (active) setError('No se pudo mostrar el PDF. Comprueba que es válido y no tiene contraseña, o ábrelo en otra pestaña.') })
    return () => { active = false; loading?.destroy().catch(() => {}) }
  }, [file])
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(150, entries[0].contentRect.width - 12)))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!document || document.file !== file) return
    let active = true, task
    setRendering(true)
    document.pdf.getPage(page).then(pdfPage => {
      if (!active) return
      const base = pdfPage.getViewport({ scale: 1 })
      const scale = width / base.width * zoom, ratio = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = pdfPage.getViewport({ scale: scale * ratio })
      const element = canvas.current
      element.width = viewport.width; element.height = viewport.height
      element.style.width = `${viewport.width / ratio}px`; element.style.height = `${viewport.height / ratio}px`
      task = pdfPage.render({ canvasContext: element.getContext('2d'), viewport })
      return task.promise
    }).catch(err => { if (active && err.name !== 'RenderingCancelledException') setError('No se pudo dibujar esta página. Puedes abrir el original en otra pestaña.') })
      .finally(() => { if (active) setRendering(false) })
    return () => { active = false; task?.cancel() }
  }, [document, file, page, zoom, width])
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-700" aria-label="Controles del PDF">
      <div className="flex items-center gap-2"><button type="button" aria-label="Página anterior" disabled={!document || page <= 1} onClick={() => setPage(value => value - 1)} className="min-h-9 rounded-lg border border-stone-300 px-2 disabled:opacity-40">Anterior</button><span>Página {page} / {document?.pdf.numPages || '…'}</span><button type="button" aria-label="Página siguiente" disabled={!document || page >= document.pdf.numPages} onClick={() => setPage(value => value + 1)} className="min-h-9 rounded-lg border border-stone-300 px-2 disabled:opacity-40">Siguiente</button></div>
      <div className="flex items-center gap-1"><button type="button" aria-label="Reducir documento" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))} className="min-h-9 min-w-9 rounded-lg border border-stone-300">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Ampliar documento" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.25))} className="min-h-9 min-w-9 rounded-lg border border-stone-300">+</button></div>
    </div>
    {error && <p role="alert" className="text-xs text-amber-800">{error}</p>}
    <div ref={container} className="max-h-[50dvh] min-h-40 overflow-auto rounded-lg bg-stone-200 p-1.5 lg:max-h-[65dvh]">
      {(!document || rendering) && !error && <p role="status" className="py-2 text-xs text-stone-600">Preparando página…</p>}
      <canvas ref={canvas} aria-label={`Página ${page} del documento original`} className="bg-white" />
    </div>
  </div>
}
