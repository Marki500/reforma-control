import { useEffect, useState } from 'react'
import { distance } from '../../utils/floorPlan'
import { Button } from '../ui/Button'

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/15 disabled:opacity-60'
export default function WallMeasurements({ wall, disabled, onApply }) {
  const length = Number(distance(wall.a, wall.b).toFixed(3))
  const [values, setValues] = useState({ length: String(length), thickness: String(wall.thickness), height: String(wall.height), fixed: 'start' })
  const [error, setError] = useState('')
  useEffect(() => { setValues(previous => ({ ...previous, length: String(length), thickness: String(wall.thickness), height: String(wall.height) })); setError('') }, [wall.id, length, wall.thickness, wall.height])
  function submit(event) {
    event.preventDefault()
    const parsed = Object.fromEntries(['length', 'thickness', 'height'].map(key => [key, Number(values[key].trim().replace(',', '.'))]))
    if (Object.values(parsed).some(value => !Number.isFinite(value)) || Object.entries(parsed).some(([key, value]) => value < ({ length: 0.2, thickness: 0.05, height: 1 })[key] || value > ({ length: 100, thickness: 1, height: 10 })[key])) { setError('Introduce medidas válidas en metros. Se admiten decimales con coma o punto.'); return }
    const problem = onApply({ ...parsed, fixed: values.fixed })
    setError(problem || '')
  }
  return <form className="space-y-3" onSubmit={submit}>
    <p className="text-xs leading-relaxed text-stone-500">Cambia las medidas y pulsa Aplicar. Las paredes conectadas se ajustarán con esta pared.</p>
    {[['length', 'Longitud de pared (m)'], ['thickness', 'Grosor de pared (m)'], ['height', 'Altura de pared (m)']].map(([key, label]) => <label key={key} className="block text-xs font-medium text-stone-600">{label}<input aria-label={label} className={fieldClass} inputMode="decimal" disabled={disabled} value={values[key]} onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
    <label className="block text-xs font-medium text-stone-600">Mantener fijo<select aria-label="Mantener fijo" className={fieldClass} disabled={disabled} value={values.fixed} onChange={event => setValues(previous => ({ ...previous, fixed: event.target.value }))}><option value="start">Extremo A</option><option value="end">Extremo B</option><option value="center">Centro de la pared</option></select></label>
    {error && <p role="alert" className="text-xs leading-relaxed text-terracotta">{error}</p>}
    <Button disabled={disabled} type="submit" className="w-full">Aplicar medidas</Button>
  </form>
}
