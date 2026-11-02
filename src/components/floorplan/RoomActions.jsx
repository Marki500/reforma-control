import { useState } from 'react'
import { Button } from '../ui/Button'

export default function RoomActions({ disabled, mode, onMode, onTransform }) {
  const [dx, setDx] = useState('1'), [dy, setDy] = useState('0'), [error, setError] = useState('')
  const field = 'mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm'
  function apply(duplicate) {
    if (!dx.trim() || !dy.trim()) { setError('Indica los dos desplazamientos en metros.'); return }
    setError(onTransform(Number(dx.replace(',', '.')), Number(dy.replace(',', '.')), duplicate) || '')
  }
  return <div className="space-y-3 border-t border-stone-100 pt-3">
    <label className="block text-xs font-medium text-stone-600">Al mover la habitación<select aria-label="Uniones al mover habitación" className={field} disabled={disabled} value={mode} onChange={e => onMode(e.target.value)}><option value="detach">Separar de las vecinas</option><option value="connected">Ajustar paredes conectadas</option></select></label>
    <p className="text-xs leading-relaxed text-stone-500">Arrastra el interior para mover la habitación con sus aberturas y muebles. Al separar, las paredes compartidas se conservan para la vecina. Al ajustar, la vecina cambia de forma.</p>
    <div className="grid grid-cols-2 gap-2">{[['X (m)', dx, setDx], ['Y (m)', dy, setDy]].map(([label, value, update]) => <label key={label} className="text-xs text-stone-600">{label}<input aria-label={`Desplazamiento ${label}`} disabled={disabled} inputMode="decimal" className={field} value={value} onChange={e => update(e.target.value)} /></label>)}</div>
    <div className="grid grid-cols-2 gap-2"><Button disabled={disabled} variant="secondary" onClick={() => apply(false)}>Mover</Button><Button disabled={disabled} variant="secondary" onClick={() => apply(true)}>Duplicar</Button></div>
    <p className="text-xs leading-relaxed text-stone-500">X positivo: derecha. Y positivo: abajo. La copia siempre se separa; elige un espacio libre.</p>
    {error && <p role="alert" className="text-xs text-terracotta">{error}</p>}
  </div>
}
