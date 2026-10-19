import { lazy, Suspense, useEffect, useState } from 'react'
import { documentReviewIssues } from '../../utils/documentReview'
const LocalPdfPreview = lazy(() => import('./LocalPdfPreview'))

export function DocumentReview({ file, children }) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview({ file, url })
    return () => URL.revokeObjectURL(url)
  }, [file])
  const url = preview?.file === file ? preview.url : null
  return <div className={file ? 'grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
    {file && <aside className="min-w-0 self-start rounded-xl border border-stone-200 bg-stone-50 p-3 lg:sticky lg:top-0" aria-label="Documento original">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-stone-800">Documento original</h3>{url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-olive underline">Abrir en otra pestaña</a>}</div>
      {url && (file.type === 'application/pdf' ? <Suspense fallback={<p role="status" className="py-8 text-sm text-stone-600">Cargando visor…</p>}><LocalPdfPreview file={file} /></Suspense> : <div className="max-h-[70dvh] overflow-auto"><img src={url} alt={`Original: ${file.name}`} className="h-auto w-full rounded-lg" /></div>)}
      <p className="mt-2 break-words text-xs text-stone-600">{file.name}</p><p className="mt-1 text-xs text-stone-500">Compara los datos antes de guardar. Si tu navegador no muestra el PDF, ábrelo en otra pestaña.</p>
    </aside>}
    <div className="min-w-0">{children}</div>
  </div>
}

export function ReviewChecks({ values, kind }) {
  const issues = documentReviewIssues(values, kind)
  return <section aria-label="Comprobaciones del documento" aria-live="polite" className={`rounded-xl border p-3 text-sm ${issues.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-stone-200 bg-stone-50 text-stone-700'}`}>
    <h3 className="font-semibold">{issues.length ? 'Datos que necesitan revisión' : 'Comprobación de importes correcta'}</h3>
    {issues.length ? <ul className="mt-2 list-inside list-disc space-y-1">{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul> : <p className="mt-1 text-xs">Confirma también que los datos coinciden con el original.</p>}
  </section>
}
