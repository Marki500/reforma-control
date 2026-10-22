import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MousePointer2, Square, Minus, DoorOpen, PanelsTopLeft, Hand, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download, Upload, Trash2, Ruler, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import PlanDrawing from './PlanDrawing'
import WallMeasurements from './WallMeasurements'
import { saveInteractiveFloorPlan } from '../../services/floorplanService'
import { addWall, distance, drawingTargets, snapDrawing, emptyPlan, fitOpening, openingParts, openingConfigurationError, resizeWall, planBounds, roomArea, projectToWall, reconcilePlan, samePoint, snap, validatePlan, wallEndpointChanges } from '../../utils/floorPlan'
import { gestureView, touchPair, zoomView } from '../../utils/planNavigation'

const tools = [
  ['select', 'Seleccionar', MousePointer2], ['wall', 'Pared', Minus], ['room', 'Habitación', Square],
  ['door', 'Puerta', DoorOpen], ['window', 'Ventana', PanelsTopLeft], ['pan', 'Mover vista', Hand],
]
const hints = {
  select: 'Selecciona una pared, habitación, puerta o ventana. Arrastra paredes y aberturas para moverlas.',
  wall: 'Marca el inicio y el final de cada pared. Continúa dibujando y pulsa Esc para terminar.',
  room: 'Marca dos esquinas opuestas para crear una habitación rectangular.',
  door: 'Pulsa sobre una pared para colocar una puerta. Después puedes moverla y ajustar su ancho.',
  window: 'Pulsa sobre una pared para colocar una ventana. Después puedes moverla y ajustar su ancho.',
  pan: 'Arrastra el lienzo para desplazarte por el plano.',
}
const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/15 disabled:opacity-60'
const snapshot = (name, data) => JSON.stringify({ name, data })

function NumberField({ label, value, min, max, onChange, disabled }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <label className="block text-xs font-medium text-stone-600">{label}<input className={inputClass} disabled={disabled} type="number" step="0.01" min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => {
    const number = Number(draft.replace(',', '.'))
    setDraft(String(value))
    if (draft.trim() && Number.isFinite(number) && number >= min && number <= max) onChange(number)
    else setDraft(String(value))
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

export default function FloorPlanEditor({ plan, rooms, canEdit, draftKey, onClose, onSaved }) {
  const initial = useRef(null)
  if (!initial.current) {
    let recovered
    try { recovered = JSON.parse(sessionStorage.getItem(draftKey)) } catch { /* Storage may be unavailable. */ }
    const valid = recovered?.baseUpdatedAt === (plan.updated_at || null) && typeof recovered?.name === 'string' && validatePlan(recovered?.data)
    initial.current = { data: valid ? recovered.data : plan.plan_data || emptyPlan(), name: valid ? recovered.name : plan.name, recovered: valid }
  }
  const [data, setData] = useState(initial.current.data), [name, setName] = useState(initial.current.name)
  const [meta, setMeta] = useState(plan), [tool, setTool] = useState('select'), [selected, setSelected] = useState(null)
  const [anchor, setAnchor] = useState(null), [cursor, setCursor] = useState(null)
  const [magnet, setMagnet] = useState(null), [navigating, setNavigating] = useState(false)
  const [view, setView] = useState(() => planBounds(initial.current.data)), [dimensions, setDimensions] = useState(true)
  const [history, setHistory] = useState({ past: [], future: [] }), [saving, setSaving] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(initial.current.recovered ? 'Borrador de esta sesión recuperado.' : '')
  const [confirmClose, setConfirmClose] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const savedSnapshot = useRef(snapshot(plan.name, plan.plan_data || emptyPlan()))
  const svgRef = useRef(), rootRef = useRef(), importRef = useRef(), gesture = useRef(null), labelBefore = useRef(null), live = useRef(data), pendingFrame = useRef(null)
  const touches = useRef(new Map()), spaceHeld = useRef(false)
  const targets = useMemo(() => ['wall', 'room'].includes(tool) ? drawingTargets(data.walls) : [], [data.walls, tool])
  const storageKey = meta.updated_at && plan.draftSlot ? draftKey.slice(0, draftKey.lastIndexOf(':') + 1) + meta.id : draftKey
  const dirty = snapshot(name, data) !== savedSnapshot.current || (!meta.updated_at && data.walls.length > 0)
  const writable = canEdit && !saving
  const wall = selected?.kind === 'wall' ? data.walls.find(w => w.id === selected.id) : null
  const opening = selected?.kind === 'opening' ? data.openings.find(o => o.id === selected.id) : null
  const room = selected?.kind === 'room' ? data.rooms.find(r => r.id === selected.id) : null

  useEffect(() => {
    const handleUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handleUnload)
    if (canEdit) {
      try {
        if (dirty) sessionStorage.setItem(storageKey, JSON.stringify({ name, data, baseUpdatedAt: meta.updated_at || null }))
        else sessionStorage.removeItem(storageKey)
      } catch { /* Manual saving and export remain available without session storage. */ }
    }
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [dirty, name, data, meta.updated_at, storageKey, canEdit])
  useEffect(() => {
    const previous = document.body.style.overflow
    const focused = document.activeElement
    document.body.style.overflow = 'hidden'
    svgRef.current?.focus()
    return () => { document.body.style.overflow = previous; focused?.focus?.(); if (pendingFrame.current) cancelAnimationFrame(pendingFrame.current) }
  }, [])
  useEffect(() => {
    const releaseSpace = event => { if (event.code === 'Space') spaceHeld.current = false }
    const blur = () => {
      spaceHeld.current = false; touches.current.clear()
      if (gesture.current?.type === 'move') { live.current = gesture.current.before; setData(live.current) }
      if (pendingFrame.current) { cancelAnimationFrame(pendingFrame.current); pendingFrame.current = null }
      gesture.current = null; setNavigating(false)
    }
    window.addEventListener('keyup', releaseSpace); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keyup', releaseSpace); window.removeEventListener('blur', blur) }
  }, [])
  useEffect(() => {
    const canvas = svgRef.current
    const wheel = event => {
      event.preventDefault()
      if (gesture.current) return
      const focus = point(event), factor = Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.002)
      setView(current => zoomView(current, factor, focus)); setMagnet(null)
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => canvas.removeEventListener('wheel', wheel)
  }, [])

  function finishLabel() {
    if (!labelBefore.current) return
    const before = labelBefore.current
    labelBefore.current = null
    commit(live.current, before)
  }
  function endTrace() { setAnchor(null); setCursor(null); setMagnet(null) }
  function changeTool(next) { finishLabel(); setNotice(''); if (next !== 'select') setSelected(null); setTool(next); endTrace() }
  function commit(next, before = data) {
    const result = reconcilePlan(next)
    if (result.openings.length < next.openings.length) { setError('Ese cambio dejaría una puerta o ventana sin espacio. Muévela o retírala primero.'); setData(before); live.current = before; return }
    if (!validatePlan(result)) { setError('Ese cambio crea medidas no válidas. Prueba con una posición o longitud diferente.'); setData(before); live.current = before; return }
    if (JSON.stringify(result) === JSON.stringify(before)) return
    setHistory(value => ({ past: [...value.past.slice(-49), before], future: [] }))
    live.current = result; setData(result); setError(''); setNotice('')
  }
  function travel(direction) {
    if (!writable || gesture.current) return
    const source = direction === 'undo' ? history.past : history.future
    if (!source.length) return
    const next = source[source.length - 1]
    setHistory(direction === 'undo' ? { past: history.past.slice(0, -1), future: [...history.future, data] } : { past: [...history.past, data], future: history.future.slice(0, -1) })
    setData(next); live.current = next; setSelected(null); setAnchor(null)
  }
  function removeSelected() {
    if (!writable || !selected) return
    if (room) { setNotice('Una habitación se define por sus paredes. Selecciona una pared para abrir o eliminar ese espacio.'); return }
    commit({ ...data, walls: data.walls.filter(w => w.id !== selected.id), openings: data.openings.filter(o => o.id !== selected.id && o.wallId !== selected.id) })
    setSelected(null)
  }
  function point(event) {
    const matrix = svgRef.current.getScreenCTM()
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }
  function magneticPoint(event) {
    const matrix = svgRef.current.getScreenCTM(), pixels = event.pointerType === 'touch' ? 18 : 10
    const tolerance = Math.max(0.015, Math.min(0.5, pixels / Math.hypot(matrix.a, matrix.b)))
    const result = snapDrawing(point(event), data.walls, tool === 'wall' ? anchor : null, tolerance, targets)
    setMagnet({ ...result, radius: tolerance * 0.4 }); return result.point
  }
  function onPointerCapture(event) {
    if (event.pointerType === 'touch') {
      event.preventDefault(); event.stopPropagation(); finishLabel()
      const node = event.target.closest?.('[data-plan-kind]')
      const target = node ? { kind: node.dataset.planKind, id: node.dataset.planId } : null
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      svgRef.current.setPointerCapture(event.pointerId)
      if (touches.current.size === 1) {
        gesture.current = { type: tool === 'pan' ? 'pan' : 'touchPending', start: point(event), startClient: { x: event.clientX, y: event.clientY }, view, matrix: svgRef.current.getScreenCTM().inverse(), target }
        if (tool === 'pan') setNavigating(true)
      } else if (touches.current.size === 2) {
        if (pendingFrame.current) { cancelAnimationFrame(pendingFrame.current); pendingFrame.current = null }
        if (gesture.current?.type === 'move') { live.current = gesture.current.before; setData(live.current) }
        const pair = touchPair(touches.current), matrix = svgRef.current.getScreenCTM().inverse()
        gesture.current = { type: 'pinch', view, matrix, span: pair.distance, start: new DOMPoint(pair.center.x, pair.center.y).matrixTransform(matrix) }
        setNavigating(true); setMagnet(null)
      }
      return
    }
    if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey || spaceHeld.current))) {
      event.preventDefault(); event.stopPropagation(); svgRef.current.focus(); finishLabel()
      gesture.current = { type: 'pan', start: point(event), view, matrix: svgRef.current.getScreenCTM().inverse() }
      svgRef.current.setPointerCapture(event.pointerId); setNavigating(true); setMagnet(null)
    }
  }
  function onElementDown(event, target) {
    if (event.button !== 0) return
    finishLabel()
    if (tool !== 'select') return
    event.preventDefault(); event.stopPropagation(); svgRef.current.focus(); setSelected(target); setError(''); setNotice('')
    if (!writable || target.kind === 'room') return
    const start = point(event)
    gesture.current = { type: 'move', target, start, before: data, matrix: svgRef.current.getScreenCTM().inverse() }
    live.current = data
    svgRef.current.setPointerCapture(event.pointerId)
  }
  function onCanvasDown(event) {
    if (event.button !== 0) return
    event.preventDefault(); svgRef.current.focus()
    finishLabel()
    const p = point(event)
    if (tool === 'pan') {
      gesture.current = { type: 'pan', start: p, view, matrix: svgRef.current.getScreenCTM().inverse() }
      svgRef.current.setPointerCapture(event.pointerId); setNavigating(true); return
    }
    if (tool === 'select') { setSelected(null); return }
    if (!writable) return
    setError(''); setNotice('')
    if (tool === 'door' || tool === 'window') {
      const nearest = data.walls.map(w => ({ wall: w, ...projectToWall(p, w) })).sort((a, b) => a.distance - b.distance)[0]
      if (!nearest || nearest.distance > 0.35) { setNotice('Coloca la abertura sobre una pared.'); return }
      const width = tool === 'door' ? 0.8 : 1.2
      const fit = fitOpening(data, nearest.wall.id, nearest.offset - width / 2, width)
      if (!fit) { setError('No hay espacio suficiente: evita los extremos y otras puertas o ventanas.'); return }
      const added = { id: crypto.randomUUID(), wallId: nearest.wall.id, type: tool, ...fit, flip: false, hinge: 'left', ...(tool === 'window' ? { windowType: 'sliding' } : {}) }
      commit({ ...data, openings: [...data.openings, added] }); setSelected({ kind: 'opening', id: added.id }); changeTool('select'); return
    }
    const next = magneticPoint(event)
    if (Math.abs(next.x) > 500 || Math.abs(next.y) > 500) { setError('Dibuja dentro de los 500 metros del origen.'); return }
    if (!anchor) { setAnchor(next); setCursor(next); return }
    let nextPlan = data
    if (tool === 'wall') {
      nextPlan = addWall(data, anchor, next)
      if (nextPlan === data) { setNotice('La pared ya existe, es demasiado corta o se ha alcanzado el límite de 200 paredes.'); return }
      commit(nextPlan); setAnchor(next); setCursor(next)
    } else {
      const a = { x: Math.min(anchor.x, next.x), y: Math.min(anchor.y, next.y) }, b = { x: Math.max(anchor.x, next.x), y: Math.max(anchor.y, next.y) }
      if (b.x - a.x < 0.5 || b.y - a.y < 0.5) { setNotice('La habitación debe medir al menos 0,50 m en cada lado.'); return }
      const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
      for (let i = 0; i < 4; i++) nextPlan = addWall(nextPlan, corners[i], corners[(i + 1) % 4])
      commit(nextPlan); setAnchor(null); setCursor(null); changeTool('select')
    }
  }
  function onMove(event) {
    let currentGesture = gesture.current
    if (event.pointerType === 'touch' && touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (currentGesture?.type === 'pinch' && touches.current.size >= 2) {
        const pair = touchPair(touches.current), center = new DOMPoint(pair.center.x, pair.center.y).matrixTransform(currentGesture.matrix)
        setView(gestureView(currentGesture.view, currentGesture.start, center, pair.distance / currentGesture.span)); return
      }
      if (currentGesture?.type === 'touchSuppress') return
      if (currentGesture?.type === 'touchPending') {
        if (distance(currentGesture.startClient, { x: event.clientX, y: event.clientY }) < 8) return
        currentGesture.cancelTap = true
        if (tool !== 'select' || !writable || !['wall', 'opening'].includes(currentGesture.target?.kind)) return
        currentGesture = { ...currentGesture, type: 'move', before: data }
        gesture.current = currentGesture; live.current = data; setSelected(currentGesture.target)
      }
    }
    if (!currentGesture) {
      if (tool === 'wall' || tool === 'room') setCursor(magneticPoint(event))
      return
    }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(currentGesture.matrix)
    const delta = snap({ x: p.x - currentGesture.start.x, y: p.y - currentGesture.start.y })
    if (currentGesture.type === 'pan') { setView(gestureView(currentGesture.view, currentGesture.start, p)); return }
    const before = currentGesture.before, target = currentGesture.target
    if (target.kind === 'wall') {
      const moving = before.walls.find(w => w.id === target.id)
      const changes = wallEndpointChanges(before, moving, { x: moving.a.x + delta.x, y: moving.a.y + delta.y }, { x: moving.b.x + delta.x, y: moving.b.y + delta.y })
      const moved = p => changes.find(change => samePoint(change.from, p))?.to || p
      // Full room detection happens once on release, not for each pointer frame.
      live.current = { ...before, walls: before.walls.map(w => ({ ...w, a: moved(w.a), b: moved(w.b) })), rooms: before.rooms.map(r => ({ ...r, points: r.points.map(moved) })) }
    } else {
      const moving = before.openings.find(o => o.id === target.id), host = before.walls.find(w => w.id === moving.wallId)
      const projectedStart = projectToWall(currentGesture.start, host).offset
      const fit = fitOpening(before, host.id, moving.offset + projectToWall(p, host).offset - projectedStart, moving.width, moving.id)
      if (fit) live.current = { ...before, openings: before.openings.map(o => o.id === moving.id ? { ...o, ...fit } : o) }
    }
    if (!pendingFrame.current) pendingFrame.current = requestAnimationFrame(() => { setData(live.current); pendingFrame.current = null })
  }
  function finishGesture(event, cancel = false) {
    const currentGesture = gesture.current
    if (!currentGesture) return
    if (event.pointerType === 'touch') {
      touches.current.delete(event.pointerId)
      if (['pinch', 'touchSuppress'].includes(currentGesture.type)) {
        gesture.current = touches.current.size ? { type: 'touchSuppress' } : null
        if (!touches.current.size) setNavigating(false)
        return
      }
      if (currentGesture.type === 'touchPending') {
        gesture.current = null
        if (!cancel && !currentGesture.cancelTap && distance(currentGesture.startClient, { x: event.clientX, y: event.clientY }) < 8) {
          if (tool === 'select') { setSelected(currentGesture.target); setNotice(''); setError('') }
          else onCanvasDown(event)
        }
        return
      }
    }
    if (pendingFrame.current) { cancelAnimationFrame(pendingFrame.current); pendingFrame.current = null }
    if (currentGesture.type === 'move') {
      if (cancel) { setData(currentGesture.before); live.current = currentGesture.before }
      else commit(live.current, currentGesture.before)
    }
    gesture.current = null; setNavigating(false)
    if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
  }
  function zoom(factor) {
    setView(current => zoomView(current, factor)); setMagnet(null)
  }
  async function save() {
    if (!writable) return
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await saveInteractiveFloorPlan({ id: meta.id, name, plan_data: data, updated_at: meta.updated_at })
      savedSnapshot.current = snapshot(saved.name, saved.plan_data)
      setMeta(saved); setName(saved.name); setNotice('Plano guardado en el proyecto.'); onSaved(saved)
      try { sessionStorage.removeItem(draftKey) } catch { /* Optional recovery storage. */ }
    } catch (err) { setError(err.message || 'No se pudo guardar. Tu dibujo sigue en el editor; puedes reintentar o exportarlo.') }
    finally { setSaving(false) }
  }
  function exportPlan() {
    const blob = new Blob([JSON.stringify({ name, ...data }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'), url = URL.createObjectURL(blob)
    link.href = url; link.download = `${name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'plano'}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importPlan(file) {
    if (!file) return
    try {
      if (file.size > 1024 * 1024) throw new Error('El archivo del plano no puede superar 1 MB.')
      const parsed = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('Selecciona un plano JSON válido exportado desde NIVEL.')
      const { name: importedName, ...importedData } = parsed
      if (!validatePlan(importedData)) throw new Error('Selecciona un plano JSON válido exportado desde NIVEL.')
      setPendingImport({ name: typeof importedName === 'string' && importedName.trim() ? importedName.slice(0, 120) : name, data: importedData })
    } catch (err) { setError(err instanceof SyntaxError ? 'El archivo no contiene un plano JSON válido.' : err.message) }
  }
  function onKeys(event) {
    if (event.key === 'Tab') {
      const controls = [...rootRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
    if (event.code === 'Space' && svgRef.current.contains(event.target)) { event.preventDefault(); spaceHeld.current = true; return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); travel('redo'); return }
    if (event.key === 'Escape') { setAnchor(null); setCursor(null); setSelected(null); changeTool('select') }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected() }
  }
  function updateOpening(changes) {
    const next = { ...opening, ...changes }, fit = fitOpening(data, next.wallId, next.offset, next.width, next.id)
    if (!fit) { setError('La abertura no cabe en esa posición o se solapa con otra.'); return }
    const configurationError = openingConfigurationError(next)
    if (configurationError) { setError(configurationError); return }
    commit({ ...data, openings: data.openings.map(o => o.id === next.id ? { ...next, ...fit } : o) })
  }
  const totalArea = data.rooms.reduce((sum, r) => sum + roomArea(r), 0)
  const instructions = canEdit ? hints[tool] : 'Plano de solo lectura. Selecciona elementos para consultar medidas o usa Mover vista para desplazarte.'
  return <section ref={rootRef} role="dialog" aria-modal="true" aria-label="Editor de planos 2D" onKeyDown={onKeys} className="fixed inset-0 z-40 flex flex-col bg-stone-100 text-stone-800">
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-stone-200 bg-white px-4 py-3 sm:flex sm:gap-3 sm:px-6">
      <button type="button" aria-label="Volver a Planos" disabled={saving} className="rounded-xl p-3 hover:bg-stone-100 disabled:opacity-50" onClick={() => dirty ? setConfirmClose(true) : onClose()}><ArrowLeft size={19} /></button>
      <div className="min-w-0 flex-1"><p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-olive">NIVEL / Plano 2D</p><input aria-label="Nombre del plano" maxLength={120} disabled={!writable} value={name} onChange={e => setName(e.target.value)} className="w-full truncate bg-transparent text-lg font-semibold outline-none focus:underline" /></div>
      <div className="col-span-3 row-start-2 flex items-center justify-end gap-1 sm:w-auto sm:gap-3"><span className="mr-auto text-[11px] text-stone-500 sm:text-xs">{!canEdit ? 'Solo lectura' : dirty ? 'Cambios sin guardar' : meta.updated_at ? 'Guardado' : 'Nuevo plano'}</span><Button variant="ghost" aria-label="Exportar plano JSON" onClick={exportPlan}><Download size={17} />Exportar</Button>{canEdit && <><Button variant="ghost" aria-label="Importar plano JSON" disabled={saving} onClick={() => importRef.current?.click()}><Upload size={17} />Importar</Button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { importPlan(event.target.files?.[0]); event.target.value = '' }} /></>}</div>
      {canEdit && <Button className="col-start-3 row-start-1" onClick={save} disabled={saving || !name.trim() || (!dirty && Boolean(meta.updated_at))}><Save size={17} />{saving ? 'Guardando…' : 'Guardar'}</Button>}
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-6">
      <div className="flex flex-wrap gap-1" aria-label="Herramientas de dibujo">{tools.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={tool === id} disabled={!writable && !['select', 'pan'].includes(id)} onClick={() => changeTool(id)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-40 ${tool === id ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}><Icon size={17} />{label}</button>)}</div>
      <div className="flex items-center gap-1"><button aria-label="Deshacer" disabled={!writable || !history.past.length} onClick={() => travel('undo')} className="rounded-lg p-3 hover:bg-stone-100 disabled:opacity-30"><Undo2 size={17} /></button><button aria-label="Rehacer" disabled={!writable || !history.future.length} onClick={() => travel('redo')} className="rounded-lg p-3 hover:bg-stone-100 disabled:opacity-30"><Redo2 size={17} /></button><button aria-label="Mostrar medidas" aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)} className={`rounded-lg p-3 ${dimensions ? 'bg-olive-light text-olive' : 'hover:bg-stone-100'}`}><Ruler size={17} /></button></div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="relative min-h-[380px] flex-1 lg:min-h-0">
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`absolute left-4 right-4 top-3 z-10 rounded-lg px-4 py-3 text-sm shadow-sm ${error ? 'bg-amber-50 text-amber-900' : 'bg-olive-light text-olive'}`}>{error || notice}</p>}
        <svg ref={svgRef} tabIndex={0} aria-label="Lienzo del plano 2D" role="application" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} className={`absolute inset-0 h-full w-full touch-none bg-[#faf9f5] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-olive ${navigating ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} onPointerDownCapture={onPointerCapture} onPointerDown={onCanvasDown} onPointerLeave={() => { if (!gesture.current) { setMagnet(null); setCursor(null) } }} onContextMenu={event => { event.preventDefault(); endTrace() }} onPointerMove={onMove} onPointerUp={event => finishGesture(event)} onPointerCancel={event => finishGesture(event, true)}>
          <defs><pattern id="plan-grid-small" width="0.1" height="0.1" patternUnits="userSpaceOnUse"><path d="M .1 0 H 0 V .1" fill="none" stroke="#e3dfd5" strokeWidth="0.006" /></pattern><pattern id="plan-grid" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="url(#plan-grid-small)" /><path d="M 1 0 H 0 V 1" fill="none" stroke="#cec8ba" strokeWidth="0.012" /></pattern></defs>
          <rect x={view.x - view.width} y={view.y - view.height} width={view.width * 3} height={view.height * 3} fill="url(#plan-grid)" />
          <PlanDrawing plan={data} selected={selected} onSelect={onElementDown} dimensions={dimensions} />
          {magnet && magnet.type !== 'grid' && !navigating && <g pointerEvents="none"><circle cx={magnet.point.x} cy={magnet.point.y} r={magnet.radius * 1.8} fill="#e5eadf" fillOpacity="0.65" /><circle cx={magnet.point.x} cy={magnet.point.y} r={magnet.radius} fill="white" stroke="#68765d" strokeWidth="0.025" /><text x={magnet.point.x} y={magnet.point.y - magnet.radius * 2.5} textAnchor="middle" fontSize="0.17" fill="#42483e" paintOrder="stroke" stroke="#faf9f5" strokeWidth="0.06">{magnet.type === 'endpoint' ? 'Extremo' : magnet.type === 'intersection' ? 'Intersección' : 'Sobre pared'}</text></g>}
          {anchor && cursor && distance(anchor, cursor) > 0.05 && (tool === 'room' ? <rect x={Math.min(anchor.x, cursor.x)} y={Math.min(anchor.y, cursor.y)} width={Math.abs(cursor.x - anchor.x)} height={Math.abs(cursor.y - anchor.y)} fill="#e5eadf" fillOpacity="0.7" stroke="#d86d4d" strokeWidth="0.06" strokeDasharray=".12 .08" pointerEvents="none" /> : <g pointerEvents="none"><line x1={anchor.x} y1={anchor.y} x2={cursor.x} y2={cursor.y} stroke="#d86d4d" strokeWidth="0.12" strokeDasharray=".15 .08" /><text x={(anchor.x + cursor.x) / 2} y={(anchor.y + cursor.y) / 2 - 0.25} textAnchor="middle" fontSize="0.2" fill="#d86d4d">{distance(anchor, cursor).toFixed(2)} m</text></g>)}
          {anchor && <circle cx={anchor.x} cy={anchor.y} r="0.08" fill="#d86d4d" pointerEvents="none" />}
        </svg>
        {!data.walls.length && !anchor && <div className="pointer-events-none absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#faf9f5]/95 p-6 text-center"><Square size={28} className="mx-auto mb-3 text-olive" /><h2 className="text-lg font-semibold">Dale forma a tu casa</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">Elige Habitación y marca dos esquinas, o empieza dibujando una Pared.</p></div>}
        <div className="absolute bottom-4 left-4 flex items-center rounded-xl border border-stone-200 bg-white shadow-sm"><button aria-label="Alejar plano" className="p-3 hover:bg-stone-50" onClick={() => zoom(1.25)}><ZoomOut size={18} /></button><span className="px-2 text-xs tabular-nums text-stone-500">{Math.round(16 / view.width * 100)}%</span><button aria-label="Acercar plano" className="p-3 hover:bg-stone-50" onClick={() => zoom(0.8)}><ZoomIn size={18} /></button><button aria-label="Centrar plano" className="border-l border-stone-200 p-3 hover:bg-stone-50" onClick={() => setView(planBounds(data))}><Maximize size={17} /></button></div>
        <p className="absolute bottom-6 right-4 rounded bg-[#faf9f5]/90 px-2 text-[11px] text-stone-500">Cuadrícula · 10 cm</p>
      </div>
      <aside aria-label="Propiedades del plano" className="shrink-0 space-y-5 border-t border-stone-200 bg-white p-5 lg:w-64 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Tu distribución</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums">{totalArea.toFixed(2)}</strong><span className="text-sm text-stone-500">m²</span></div><p className="mt-1 text-xs text-stone-500">{data.rooms.length} {data.rooms.length === 1 ? 'habitación' : 'habitaciones'} · {data.walls.length} {data.walls.length === 1 ? 'pared' : 'paredes'}</p><p className="mt-2 text-[11px] leading-relaxed text-stone-400">Superficie aproximada entre ejes de pared.</p></div>
        <div className="border-t border-stone-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold">{wall ? 'Pared seleccionada' : opening ? opening.type === 'door' ? 'Puerta seleccionada' : 'Ventana seleccionada' : room ? 'Habitación seleccionada' : 'Cómo empezar'}</h2>
          {!selected && <p className="text-sm leading-relaxed text-stone-600">{instructions}</p>}
          {wall && <div className="space-y-3">
            <WallMeasurements key={wall.id} wall={wall} disabled={!writable} onApply={values => {
              try { commit(resizeWall(data, wall.id, values)); setNotice('Medidas de pared aplicadas.'); return '' }
              catch (err) { return err.message }
            }} />
            <p className="text-xs leading-relaxed text-stone-500">Arrastra la pared para moverla. Las paredes unidas a sus extremos se ajustan con ella.</p>
          </div>}
          {opening && <div className="space-y-3">
            <NumberField label="Ancho total del hueco (m)" value={opening.width} min={0.3} max={10} disabled={!writable} onChange={width => updateOpening({ width })} />
            <NumberField label="Distancia al inicio de pared (m)" value={Number(opening.offset.toFixed(2))} min={0.05} max={100} disabled={!writable} onChange={offset => updateOpening({ offset })} />
            {opening.type === 'window' && <label className="block text-xs font-medium text-stone-600">Tipo de ventana<select aria-label="Tipo de ventana" className={inputClass} disabled={!writable} value={opening.windowType || 'sliding'} onChange={event => updateOpening({ windowType: event.target.value })}><option value="sliding">Corredera</option><option value="casement">Abatible</option></select></label>}
            {opening.type === 'window' && opening.windowType === 'casement' && <label className="block text-xs font-medium text-stone-600">Número de hojas<select aria-label="Número de hojas" className={inputClass} disabled={!writable} value={opening.windowLeaves || 1} onChange={event => updateOpening({ windowLeaves: Number(event.target.value) })}><option value={1}>1 hoja</option><option value={2}>2 hojas</option></select></label>}
            {opening.type === 'door' && <>
              <label className="block text-xs font-medium text-stone-600">Fijo lateral<select aria-label="Fijo lateral" className={inputClass} disabled={!writable} value={opening.fixedSide || 'none'} onChange={event => {
                const fixedSide = event.target.value, count = fixedSide === 'both' ? 2 : 1
                const fixedWidth = opening.fixedWidth ?? Math.min(0.3, Math.floor((opening.width - 0.3) / count * 100 + 1e-6) / 100)
                updateOpening({ fixedSide, ...(fixedSide === 'none' ? {} : { fixedWidth }) })
              }}><option value="none">Sin fijo</option><option value="left">Izquierdo</option><option value="right">Derecho</option><option value="both">A ambos lados</option></select></label>
              {opening.fixedSide && opening.fixedSide !== 'none' && <>
                <NumberField label={opening.fixedSide === 'both' ? 'Ancho de cada fijo (m)' : 'Ancho del fijo (m)'} value={opening.fixedWidth ?? 0.3} min={0.1} max={3} disabled={!writable} onChange={fixedWidth => updateOpening({ fixedWidth })} />
                <p className="text-xs leading-relaxed text-stone-500">Hoja de puerta: {openingParts(opening).leaves[0].width.toFixed(2)} m. El ancho total incluye los fijos, marcados con F en el plano. Amplía el hueco para conservar el ancho de paso.</p>
              </>}
            </>}
            {(opening.type === 'door' || opening.windowType === 'casement') && <>
              {!(opening.type === 'window' && opening.windowLeaves === 2) && <label className="block text-xs font-medium text-stone-600">Bisagras<select aria-label="Bisagras" className={inputClass} disabled={!writable} value={opening.hinge || 'left'} onChange={event => updateOpening({ hinge: event.target.value })}><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>}
              <Button className="w-full" variant="secondary" disabled={!writable} onClick={() => updateOpening({ flip: !opening.flip })}><RotateCcw size={16} />Invertir sentido de apertura</Button>
              <p className="text-xs leading-relaxed text-stone-500">{opening.type === 'window' && opening.windowLeaves === 2 ? 'Las dos hojas tienen bisagras en los extremos y abren hacia el mismo lado. Puedes invertir su apertura.' : 'La bisagra y el sentido se cambian por separado: puedes combinar izquierda o derecha con apertura hacia cualquiera de los dos lados de la pared.'} El arco muestra el recorrido.</p>
            </>}
            <p className="text-xs text-stone-500">Arrastra la abertura a lo largo de su pared.</p>
          </div>}
          {room && <div className="space-y-3"><label className="block text-xs font-medium text-stone-600">Nombre de habitación<input className={inputClass} value={room.name} maxLength={80} disabled={!writable} onChange={event => {
            const next = { ...data, rooms: data.rooms.map(r => r.id === room.id ? { ...r, name: event.target.value } : r) }
            // Room labels don't change geometry; keep typing as one undo action on blur.
            if (!labelBefore.current) labelBefore.current = data
            setData(next); live.current = next
          }} onBlur={finishLabel} /></label><label className="block text-xs font-medium text-stone-600">Estancia de la aplicación<select className={inputClass} value={room.roomId} disabled={!writable} onChange={event => commit({ ...data, rooms: data.rooms.map(r => r.id === room.id ? { ...r, roomId: event.target.value, name: rooms.find(item => item.id === event.target.value)?.name || r.name } : r) })}><option value="">Sin vincular</option>{rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="text-sm text-olive">{roomArea(room).toFixed(2)} m² aproximadamente</p><p className="text-xs leading-relaxed text-stone-500">Se reconoce al cerrar paredes. Al abrir o dividir el espacio, revisa los nombres y vínculos de las nuevas habitaciones.</p></div>}
          {selected && !wall && !opening && !room && <p className="text-sm text-stone-500">Selecciona otro elemento del plano.</p>}
          {(wall || opening) && canEdit && <button disabled={!writable} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-terracotta disabled:opacity-50" onClick={removeSelected}><Trash2 size={16} />Eliminar {wall ? 'pared' : 'abertura'}</button>}
        </div>
        {data.rooms.length > 0 && <div className="border-t border-stone-100 pt-4"><h3 className="mb-2 text-xs font-semibold text-stone-600">Habitaciones</h3><div className="space-y-1">{data.rooms.map(r => <button key={r.id} onClick={() => { setSelected({ kind: 'room', id: r.id }); changeTool('select') }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs ${selected?.id === r.id ? 'bg-olive-light text-olive' : 'hover:bg-stone-50'}`}><span className="truncate">{r.name || 'Sin nombre'}</span><span className="shrink-0 tabular-nums">{roomArea(r).toFixed(1)} m²</span></button>)}</div></div>}
        {data.walls.length > 0 && <details className="border-t border-stone-100 pt-4"><summary className="min-h-8 cursor-pointer text-xs font-semibold text-stone-600">Paredes · {data.walls.length}</summary><div className="mt-2 space-y-1">{data.walls.map((item, index) => <button key={item.id} type="button" onClick={() => { changeTool('select'); setSelected({ kind: 'wall', id: item.id }) }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-xs ${selected?.id === item.id ? 'bg-olive-light text-olive' : 'hover:bg-stone-50'}`}><span>Pared {index + 1}</span><span className="tabular-nums">{distance(item.a, item.b).toFixed(2)} m</span></button>)}</div></details>}
      </aside>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-2.5 text-xs leading-relaxed text-stone-500"><div>{anchor ? 'Marca el siguiente punto.' : instructions}<span className="mt-1 block text-[11px]">Ctrl o espacio + arrastrar: mover vista · Rueda: zoom · Dos dedos: mover y ampliar</span></div>{anchor && <button type="button" className="min-h-11 shrink-0 rounded-lg bg-stone-100 px-3 font-medium text-stone-700 hover:bg-stone-200" onClick={endTrace}>Terminar trazo</button>}</footer>
    <ConfirmDialog open={confirmClose} title="Hay cambios sin guardar" message="Puedes volver al editor para guardarlos. Si sales, conservaremos un borrador en esta sesión del navegador." confirmLabel="Salir del editor" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />
    <ConfirmDialog open={Boolean(pendingImport)} title="Importar distribución" message="El archivo sustituirá el dibujo actual en el editor. Puedes deshacer el cambio antes de guardar." confirmLabel="Importar plano" onCancel={() => setPendingImport(null)} onConfirm={() => { commit(pendingImport.data); setName(pendingImport.name); setView(planBounds(pendingImport.data)); setSelected(null); setAnchor(null); setPendingImport(null) }} />
  </section>
}
