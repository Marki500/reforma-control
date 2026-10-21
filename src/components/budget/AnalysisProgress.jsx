import { useEffect, useState } from 'react'

const stages = {
  checking: [0, 'Comprobando el servicio', 'Conectando para iniciar el análisis.'],
  uploading: [0, 'Enviando el documento', 'El archivo se está enviando al servidor.'],
  preparing: [1, 'Preparando el documento', 'Extrayendo el texto y comprobando las páginas.'],
  rendering: [1, 'Preparando la lectura visual', 'Convirtiendo las páginas para leer el documento escaneado.'],
  analyzing: [2, 'Leyendo con IA', 'Extrayendo conceptos, tablas e importes. Esta fase puede tardar unos minutos.'],
  validating: [3, 'Comprobando el resultado', 'Preparando los datos para que puedas revisarlos.'],
  complete: [4, 'Análisis terminado', 'El borrador está listo para revisar.'],
  processing: [1, 'Procesando el documento', 'Esperando el resultado del servidor.'],
  reconnecting: [1, 'Recuperando la conexión', 'El análisis puede seguir en marcha. Estamos consultando su estado.'],
}

export default function AnalysisProgress({ progress }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const [step, title, detail] = stages[progress?.stage] || stages.checking
  const pageDetail = progress?.stage === 'rendering' && progress.page_count
    ? `Preparando página ${progress.page} de ${progress.page_count}.` : detail
  return <div className="rounded-xl bg-stone-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="text-sm font-semibold text-stone-800">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">{pageDetail}</p>
      </div>
      <span aria-label="Tiempo transcurrido" className="shrink-0 text-xs tabular-nums text-stone-500">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
    </div>
    <div role="progressbar" aria-label="Fases del análisis" aria-valuemin={0} aria-valuemax={5} aria-valuenow={progress?.stage === 'complete' ? 5 : step} aria-valuetext={title} className="mt-4 flex gap-1.5">
      {[0, 1, 2, 3, 4].map(index => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < step || progress?.stage === 'complete' ? 'bg-olive' : index === step ? 'bg-terracotta motion-safe:animate-pulse' : 'bg-stone-200'}`} />)}
    </div>
    <p className="mt-2 text-[11px] text-stone-500">Avance por fases · La IA no informa de un porcentaje exacto.</p>
  </div>
}
