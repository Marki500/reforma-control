import { useState, useEffect } from 'react'
import { sampleFrames } from '../../utils/materialsDiagnostics'

export default function MaterialsDiagnostics({ collect }) {
  const [report, setReport] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [flat, setFlat] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('materials-performance-probe', flat)
    return () => document.documentElement.classList.remove('materials-performance-probe')
  }, [flat])
  async function copy() {
    setBusy(true)
    setNotice('Midiendo la fluidez durante un segundo…')
    const frames = await sampleFrames()
    const text = JSON.stringify({ ...collect(), visual_effects_disabled: flat, frame_sample: frames,
      browser: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, visibility: document.visibilityState }, null, 2)
    setBusy(false)
    setReport(text)
    try { await navigator.clipboard.writeText(text); setNotice('Informe copiado.') }
    catch { setNotice('Selecciona y copia el informe que aparece debajo.') }
  }
  return <details className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
    <summary className="cursor-pointer font-medium">Diagnóstico de carga</summary>
    <p className="mt-3">Después de notar la lentitud, copia el informe para revisar tiempos de datos e imágenes. No incluye credenciales ni se envía automáticamente.</p>
    <label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={flat} onChange={event => setFlat(event.target.checked)} />Prueba temporal: sin efectos visuales</label>
    <button type="button" disabled={busy} onClick={copy} className="mt-2 min-h-11 rounded-lg bg-stone-100 px-3 font-medium">Copiar informe</button>
    {notice && <p role="status" className="mt-2">{notice}</p>}
    {report && <pre tabIndex={0} className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-stone-50 p-3 text-xs">{report}</pre>}
  </details>
}
