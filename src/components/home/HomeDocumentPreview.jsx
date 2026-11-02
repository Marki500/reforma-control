import { lazy, Suspense, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { getHomeDocumentPreview } from '../../services/homeDocumentsService'

const LocalPdfPreview = lazy(() => import('../budget/LocalPdfPreview'))

export default function HomeDocumentPreview({ document, onClose }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!document) return
    const controller = new AbortController()
    let objectUrl
    setPreview(null); setError('')
    getHomeDocumentPreview(document, controller.signal).then(result => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(result.file)
      setPreview({ ...result, objectUrl })
    }).catch(error => {
      if (!controller.signal.aborted) setError(error.message || 'No se pudo cargar el documento.')
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document, attempt])

  return <Modal open={Boolean(document)} onClose={onClose} title={document?.title || 'Vista previa'} wide>
    {error ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button type="button" className="font-semibold underline" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>{document?.access_url && <a href={document.access_url} target="_blank" rel="noopener noreferrer" className="ml-4 underline">Abrir en otra pestaña</a>}</div>
      : !preview ? <p role="status" className="py-12 text-center text-sm text-stone-500">Cargando documento…</p>
        : <div className="space-y-3">
          <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-olive"><ExternalLink size={16} />Abrir en otra pestaña</a>
          {preview.file.type === 'application/pdf'
            ? <Suspense fallback={<p role="status" className="py-8 text-sm text-stone-500">Cargando visor…</p>}><LocalPdfPreview file={preview.file} /></Suspense>
            : <img src={preview.objectUrl} alt={document?.title || 'Documento'} className="mx-auto max-h-[70dvh] max-w-full rounded-lg object-contain" onError={() => setError('No se pudo mostrar la imagen. Prueba a abrirla en otra pestaña.')} />}
        </div>}
  </Modal>
}
