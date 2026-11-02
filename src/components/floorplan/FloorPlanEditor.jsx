import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MousePointer2, Square, Minus, DoorOpen, PanelsTopLeft, Hand, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download, Upload, Trash2, Ruler, RotateCcw, Armchair, LockKeyhole, UnlockKeyhole, Box, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import PlanDrawing from './PlanDrawing'
import PlanJunctions from './PlanJunctions'
import WallMeasurements from './WallMeasurements'
import RoomActions from './RoomActions'
import PlanDimensions from './PlanDimensions'
import Plan3D from './Plan3D'
import { saveInteractiveFloorPlan } from '../../services/floorplanService'
import { addWall, distance, drawingTargets, snapDrawing, emptyPlan, fitOpening, openingParts, openingElevation, openingConfigurationError, resizeWall, planBounds, roomArea, projectToWall, reconcilePlan, samePoint, snap, validatePlan, wallEndpointChanges } from '../../utils/floorPlan'
import { gestureView, touchPair, zoomView } from '../../utils/planNavigation'
import { transformRoom, lockedChangeError, roomInteriorDimensions, furnitureWarnings, planJunctions, movePlanJunction } from '../../utils/planEditing'
import { furnitureCatalog } from '../../utils/planFurniture'

const tools = [
  ['select', 'Seleccionar', MousePointer2], ['wall', 'Pared', Minus], ['room', 'Habitación', Square],
  ['door', 'Puerta', DoorOpen], ['window', 'Ventana', PanelsTopLeft], ['furniture', 'Muebles', Armchair], ['pan', 'Mover vista', Hand],
]
const hints = {
  select: 'Arrastra los puntos de unión para ajustar todas sus paredes juntas, o selecciona paredes, habitaciones, aberturas y muebles.',
  wall: 'Marca el inicio y el final de cada pared. Continúa dibujando y pulsa Esc para terminar.',
  room: 'Marca dos esquinas opuestas para crear una habitación rectangular.',
  door: 'Pulsa sobre una pared para colocar una puerta. Después puedes moverla y ajustar su ancho.',
  window: 'Pulsa sobre una pared para colocar una ventana. Después puedes moverla y ajustar su ancho.',
  pan: 'Arrastra el lienzo para desplazarte por el plano.',
  furniture: 'Elige un mueble en el panel y pulsa sobre el plano para colocarlo a escala.',
}
const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/15 disabled:opacity-60'
const snapshot = (name, data) => JSON.stringify({ name, data })

function NumberField({ label, value, min, max, onChange, disabled }) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState('')
  useEffect(() => { setDraft(String(value)); setError('') }, [value])
  return <label className="block text-xs font-medium text-stone-600">{label}<input aria-label={label} aria-invalid={Boolean(error)} className={inputClass} disabled={disabled} type="text" inputMode="decimal" value={draft} onChange={event => { setDraft(event.target.value); setError('') }} onBlur={() => {
    const normalized = draft.trim().replace(',', '.'), number = Number(normalized)
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) || !Number.isFinite(number) || number < min || number > max) {
      setError(`Introduce un valor entre ${min} y ${max}. Se admite coma o punto decimal.`)
      return
    }
    setError(''); onChange(number); setDraft(String(value))
  }} onKeyDown={event => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
    if (event.key === 'Escape') { event.stopPropagation(); setDraft(String(value)); setError('') }
  }} />{error && <span role="alert" className="mt-1 block text-xs text-terracotta">{error}</span>}</label>
}

export default function FloorPlanEditor({ plan, rooms, canEdit, draftKey, onClose, onSaved }) {
  const initial = useRef(null)
  if (!initial.current) {
    let recovered
    try { recovered = JSON.parse(sessionStorage.getItem(draftKey)) } catch { /* Storage may be unavailable. */ }
    const valid = canEdit && recovered?.baseUpdatedAt === (plan.updated_at || null) && typeof recovered?.name === 'string' && validatePlan(recovered?.data)
    initial.current = { data: valid ? recovered.data : plan.plan_data || emptyPlan(), name: valid ? recovered.name : plan.name, recovered: valid }
  }
  const [data, setData] = useState(initial.current.data), [name, setName] = useState(initial.current.name)
  const [meta, setMeta] = useState(plan), [tool, setTool] = useState('select'), [selected, setSelected] = useState(null)
  const [anchor, setAnchor] = useState(null), [cursor, setCursor] = useState(null)
  const [magnet, setMagnet] = useState(null), [navigating, setNavigating] = useState(false)
  const [view, setView] = useState(() => planBounds(initial.current.data)), [dimensions, setDimensions] = useState(true)
  const [gridStep, setGridStep] = useState(0.1), [propertiesOpen, setPropertiesOpen] = useState(false)
  const [history, setHistory] = useState({ past: [], future: [] }), [saving, setSaving] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(initial.current.recovered ? 'Borrador de esta sesión recuperado.' : '')
  const [confirmClose, setConfirmClose] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [sceneMode, setSceneMode] = useState('2d'), [roomMoveMode, setRoomMoveMode] = useState('detach'), [furnitureType, setFurnitureType] = useState('sofa')
  const [exportFormat, setExportFormat] = useState('json'), [exporting, setExporting] = useState(false)
  const savedSnapshot = useRef(snapshot(plan.name, plan.plan_data || emptyPlan()))
  const svgRef = useRef(), rootRef = useRef(), importRef = useRef(), gesture = useRef(null), labelBefore = useRef(null), live = useRef(data), pendingFrame = useRef(null)
  const touches = useRef(new Map()), spaceHeld = useRef(false)
  useEffect(() => { setPropertiesOpen(Boolean(selected) || tool === 'furniture') }, [selected?.kind, selected?.id, tool])
  const targets = useMemo(() => ['wall', 'room'].includes(tool) ? drawingTargets(data.walls) : [], [data.walls, tool])
  const junctions = useMemo(() => planJunctions(data), [data.walls])
  const storageKey = meta.updated_at && plan.draftSlot ? draftKey.slice(0, draftKey.lastIndexOf(':') + 1) + meta.id : draftKey
  const dirty = snapshot(name, data) !== savedSnapshot.current || (!meta.updated_at && data.walls.length > 0)
  const writable = canEdit && !saving
  const wall = selected?.kind === 'wall' ? data.walls.find(w => w.id === selected.id) : null
  const opening = selected?.kind === 'opening' ? data.openings.find(o => o.id === selected.id) : null
  const room = selected?.kind === 'room' ? data.rooms.find(r => r.id === selected.id) : null
  const furniture = selected?.kind === 'furniture' ? (data.furniture || []).find(f => f.id === selected.id) : null
  const junction = selected?.kind === 'junction' ? junctions.find(item => item.id === selected.id) || selected : null
  const currentElement = wall || opening || room || furniture || junction, editable = writable && !currentElement?.locked

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
    const lockError = lockedChangeError(before, result)
    if (lockError) { setError(lockError); setData(before); live.current = before; return false }
    if (result.openings.length < next.openings.length) { setError('Ese cambio dejaría una puerta o ventana sin espacio. Muévela o retírala primero.'); setData(before); live.current = before; return }
    if (!validatePlan(result)) { setError('Ese cambio crea medidas no válidas. Prueba con una posición o longitud diferente.'); setData(before); live.current = before; return }
    if (JSON.stringify(result) === JSON.stringify(before)) return
    setHistory(value => ({ past: [...value.past.slice(-49), before], future: [] }))
    live.current = result; setData(result); setError(''); setNotice(''); return true
  }
  function travel(direction) {
    if (!writable || gesture.current) return
    const source = direction === 'undo' ? history.past : history.future
    if (!source.length) return
    const next = source[source.length - 1]
    setHistory(direction === 'undo' ? { past: history.past.slice(0, -1), future: [...history.future, data] } : { past: [...history.past, data], future: history.future.slice(0, -1) })
    setData(next); live.current = next; setSelected(null); endTrace()
  }
  function removeSelected() {
    if (!writable || !selected) return
    if (junction) { setNotice('Este punto une sus paredes. Selecciona una pared para eliminarla sin borrar las demás.'); return }
    if (room) { setNotice('Una habitación se define por sus paredes. Selecciona una pared para abrir o eliminar ese espacio.'); return }
    if (commit({ ...data, walls: data.walls.filter(w => w.id !== selected.id), openings: data.openings.filter(o => o.id !== selected.id && o.wallId !== selected.id), ...(data.furniture ? { furniture: data.furniture.filter(f => f.id !== selected.id) } : {}) })) setSelected(null)
  }
  function point(event) {
    const matrix = svgRef.current.getScreenCTM()
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }
  function magneticPoint(event) {
    const matrix = svgRef.current.getScreenCTM(), pixels = event.pointerType === 'touch' ? 18 : 10
    const tolerance = Math.max(0.015, Math.min(0.5, pixels / Math.hypot(matrix.a, matrix.b)))
    const result = snapDrawing(point(event), data.walls, tool === 'wall' ? anchor : null, tolerance, targets, gridStep)
    setMagnet({ ...result, radius: tolerance * 0.4 }); return result.point
  }
  function onPointerCapture(event) {
    if (event.pointerType === 'touch') {
      event.preventDefault(); event.stopPropagation(); finishLabel()
      const node = event.target.closest?.('[data-plan-kind]')
      const target = node ? { kind: node.dataset.planKind, id: node.dataset.planId, ...(node.dataset.planKind === 'junction' ? junctions.find(item => item.id === node.dataset.planId) : {}) } : null
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
    const collection = { wall: data.walls, opening: data.openings, room: data.rooms, furniture: data.furniture || [] }[target.kind]
    if (!writable || target.locked || collection?.find(item => item.id === target.id)?.locked) return
    const start = point(event)
    gesture.current = { type: 'move', target, start, startClient: { x: event.clientX, y: event.clientY }, before: data, matrix: svgRef.current.getScreenCTM().inverse() }
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
    if (tool === 'furniture') {
      if ((data.furniture || []).length >= 200) { setError('Máximo de 200 muebles por plano.'); return }
      const definition = furnitureCatalog[furnitureType], position = snap(p, gridStep)
      const item = { id: crypto.randomUUID(), type: furnitureType, name: definition.name, x: position.x, y: position.y, width: definition.width, depth: definition.depth, height: definition.height, rotation: 0 }
      if (commit({ ...data, furniture: [...(data.furniture || []), item] })) { changeTool('select'); setSelected({ kind: 'furniture', id: item.id }) }
      return
    }
    if (tool === 'door' || tool === 'window') {
      const nearest = data.walls.map(w => ({ wall: w, ...projectToWall(p, w) })).sort((a, b) => a.distance - b.distance)[0]
      if (!nearest || nearest.distance > 0.35) { setNotice('Coloca la abertura sobre una pared.'); return }
      if (nearest.wall.locked) { setError('Desbloquea la pared antes de añadir aberturas.'); return }
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
      if (commit(nextPlan)) { setAnchor(next); setCursor(next) }
    } else {
      const a = { x: Math.min(anchor.x, next.x), y: Math.min(anchor.y, next.y) }, b = { x: Math.max(anchor.x, next.x), y: Math.max(anchor.y, next.y) }
      if (b.x - a.x < 0.5 || b.y - a.y < 0.5) { setNotice('La habitación debe medir al menos 0,50 m en cada lado.'); return }
      const corners = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
      for (let i = 0; i < 4; i++) nextPlan = addWall(nextPlan, corners[i], corners[(i + 1) % 4])
      if (commit(nextPlan)) changeTool('select')
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
        if (tool !== 'select' || !writable || !['wall', 'opening', 'room', 'furniture', 'junction'].includes(currentGesture.target?.kind)) return
        const collection = { wall: data.walls, opening: data.openings, room: data.rooms, furniture: data.furniture || [] }[currentGesture.target.kind]
        if (currentGesture.target.locked || collection?.find(item => item.id === currentGesture.target.id)?.locked) return
        currentGesture = { ...currentGesture, type: 'move', before: data }
        gesture.current = currentGesture; live.current = data; setSelected(currentGesture.target)
      }
    }
    if (!currentGesture) {
      if (tool === 'wall' || tool === 'room') setCursor(magneticPoint(event))
      return
    }
    if (currentGesture.type === 'move' && event.pointerType !== 'touch' && !currentGesture.moved) {
      if (distance(currentGesture.startClient, { x: event.clientX, y: event.clientY }) < 4) return
      currentGesture.moved = true
    }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(currentGesture.matrix)
    const delta = snap({ x: p.x - currentGesture.start.x, y: p.y - currentGesture.start.y }, gridStep)
    if (currentGesture.type === 'pan') { setView(gestureView(currentGesture.view, currentGesture.start, p)); return }
    const before = currentGesture.before, target = currentGesture.target
    if (target.kind === 'junction') {
      const destination = { x: target.point.x + delta.x, y: target.point.y + delta.y }
      currentGesture.junctionIds ||= []
      let idIndex = 0
      try {
        live.current = movePlanJunction(before, target.point, destination, () => currentGesture.junctionIds[idIndex++] ||= crypto.randomUUID())
        currentGesture.junctionDestination = destination
        setError('')
      } catch (err) { live.current = before; currentGesture.junctionDestination = null; setError(err.message) }
    } else if (target.kind === 'room') {
      if (Math.hypot(delta.x, delta.y) < 0.001) { live.current = before; return }
      try { live.current = transformRoom(before, target.id, delta.x, delta.y, { mode: roomMoveMode }); setError('') }
      catch (err) { live.current = before; setError(err.message) }
    } else if (target.kind === 'furniture') {
      live.current = { ...before, furniture: before.furniture.map(f => f.id === target.id ? { ...f, x: f.x + delta.x, y: f.y + delta.y } : f) }
    } else if (target.kind === 'wall') {
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
    const lockError = lockedChangeError(before, live.current)
    if (lockError) { live.current = before; setError(lockError) }
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
      else {
        const applied = commit(live.current, currentGesture.before)
        if (applied && currentGesture.target.kind === 'junction' && currentGesture.junctionDestination) {
          const point = currentGesture.junctionDestination
          setSelected({ ...currentGesture.target, point, id: `${point.x.toFixed(3)},${point.y.toFixed(3)}` })
        }
      }
    }
    gesture.current = null; setNavigating(false)
    if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
  }
  function zoom(factor) {
    setView(current => zoomView(current, factor)); setMagnet(null)
  }
  async function save() {
    if (!writable) return
    if (gesture.current) { setNotice('Termina el movimiento antes de guardar.'); return }
    finishLabel()
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await saveInteractiveFloorPlan({ id: meta.id, name, plan_data: live.current, updated_at: meta.updated_at })
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
  async function exportDrawing() {
    if (exportFormat === 'json') { exportPlan(); return }
    setExporting(true); setError(''); setNotice('')
    try { const { exportFloorPlan } = await import('../../utils/exportFloorPlan'); await exportFloorPlan(data, name, exportFormat, dimensions); setNotice(`Exportación ${exportFormat.toUpperCase()} preparada.`) }
    catch (err) { setError(err.message || 'No se pudo exportar el plano.') }
    finally { setExporting(false) }
  }
  function toggleLock() {
    if (!writable || !currentElement) return
    const key = { wall: 'walls', opening: 'openings', room: 'rooms', furniture: 'furniture' }[selected.kind]
    commit({ ...data, [key]: data[key].map(item => item.id === selected.id ? { ...item, locked: !item.locked } : item) })
  }
  function updateFurniture(changes) {
    if (!editable || !furniture) return
    commit({ ...data, furniture: data.furniture.map(f => f.id === furniture.id ? { ...f, ...changes } : f) })
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.target.blur?.(); save(); return }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return
    if (event.code === 'Space' && svgRef.current.contains(event.target)) { event.preventDefault(); spaceHeld.current = true; return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); travel('redo'); return }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && sceneMode === '2d' && !gesture.current) {
      const shortcut = { v: 'select', p: 'wall', h: 'pan', r: 'room' }[event.key.toLowerCase()]
      if (shortcut && (writable || ['select', 'pan'].includes(shortcut))) { event.preventDefault(); changeTool(shortcut); return }
      if (['+', '=', '-','0'].includes(event.key)) { event.preventDefault(); if (event.key === '0') setView(planBounds(data)); else zoom(event.key === '-' ? 1.25 : 0.8); return }
    }
    if (event.key === 'Escape') { setAnchor(null); setCursor(null); setSelected(null); changeTool('select') }
    if (sceneMode === '2d' && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); removeSelected() }
  }
  function updateOpening(changes) {
    if (!editable) return
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
      <div className="min-w-0 flex-1"><p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-olive">NIVEL / Plano {sceneMode.toUpperCase()}</p><input aria-label="Nombre del plano" maxLength={120} disabled={!writable} value={name} onChange={e => setName(e.target.value)} className="w-full truncate bg-transparent text-lg font-semibold outline-none focus:underline" /></div>
      <div className="col-span-3 row-start-2 flex flex-wrap items-center justify-end gap-1 sm:w-auto sm:gap-3"><span className="mr-auto text-[11px] text-stone-500 sm:text-xs">{!canEdit ? 'Solo lectura' : dirty ? 'Cambios sin guardar' : meta.updated_at ? 'Guardado' : 'Nuevo plano'}</span><select aria-label="Formato de exportación" value={exportFormat} onChange={e => setExportFormat(e.target.value)} disabled={exporting} className="min-h-11 rounded-lg border border-stone-200 bg-white px-2 text-xs"><option value="json">JSON editable</option><option value="png">Imagen 2D · PNG</option><option value="pdf">Plano 2D · PDF</option></select><Button variant="ghost" disabled={exporting} aria-label={`Exportar plano ${exportFormat.toUpperCase()}`} onClick={exportDrawing}><Download size={17} />{exporting ? 'Exportando…' : 'Exportar'}</Button>{canEdit && <><Button variant="ghost" aria-label="Importar plano JSON" disabled={saving} onClick={() => importRef.current?.click()}><Upload size={17} />Importar</Button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { importPlan(event.target.files?.[0]); event.target.value = '' }} /></>}</div>
      {canEdit && <Button className="col-start-3 row-start-1" onClick={save} disabled={saving || !name.trim() || (!dirty && Boolean(meta.updated_at))}><Save size={17} />{saving ? 'Guardando…' : 'Guardar'}</Button>}
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-6">
      <div className="flex min-w-0 max-w-full flex-nowrap gap-1 overflow-x-auto pb-1" aria-label="Herramientas de dibujo"><div className="mr-2 flex shrink-0 gap-1 border-r border-stone-200 pr-2">{['2d', '3d'].map(mode => <button key={mode} type="button" aria-label={`Vista ${mode.toUpperCase()}`} aria-pressed={sceneMode === mode} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${sceneMode === mode ? 'bg-olive-light text-olive' : 'text-stone-500'}`} onClick={() => { finishLabel(); endTrace(); setSceneMode(mode); setSelected(null) }}>{mode === '3d' && <Box size={16} />}{mode.toUpperCase()}</button>)}</div>{sceneMode === '2d' && tools.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={tool === id} disabled={!writable && !['select', 'pan'].includes(id)} onClick={() => changeTool(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-40 ${tool === id ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}><Icon size={17} />{label}</button>)}</div>
      <div className="flex items-center gap-1"><button aria-label="Deshacer" disabled={!writable || !history.past.length} onClick={() => travel('undo')} className="rounded-lg p-3 hover:bg-stone-100 disabled:opacity-30"><Undo2 size={17} /></button><button aria-label="Rehacer" disabled={!writable || !history.future.length} onClick={() => travel('redo')} className="rounded-lg p-3 hover:bg-stone-100 disabled:opacity-30"><Redo2 size={17} /></button><button aria-label="Mostrar medidas" aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)} className={`rounded-lg p-3 ${dimensions ? 'bg-olive-light text-olive' : 'hover:bg-stone-100'}`}><Ruler size={17} /></button><button type="button" aria-label="Propiedades del elemento" aria-expanded={propertiesOpen} aria-controls="plan-properties" onClick={() => setPropertiesOpen(value => !value)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs lg:hidden ${propertiesOpen ? 'bg-olive-light text-olive' : 'hover:bg-stone-100'}`}><SlidersHorizontal size={17} />Propiedades</button></div>
    </div>
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative min-h-0 min-w-0 flex-1">
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`absolute left-4 right-4 top-3 z-10 rounded-lg px-4 py-3 text-sm shadow-sm ${error ? 'bg-amber-50 text-amber-900' : 'bg-olive-light text-olive'}`}>{error || notice}</p>}
        <svg ref={svgRef} style={sceneMode === '3d' ? { display: 'none' } : undefined} tabIndex={0} aria-label="Lienzo del plano 2D" role="application" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} className={`absolute inset-0 h-full w-full touch-none bg-[#faf9f5] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-olive ${navigating ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} onPointerDownCapture={onPointerCapture} onPointerDown={onCanvasDown} onPointerLeave={() => { if (!gesture.current) { setMagnet(null); setCursor(null) } }} onContextMenu={event => { event.preventDefault(); endTrace() }} onPointerMove={onMove} onPointerUp={event => finishGesture(event)} onPointerCancel={event => finishGesture(event, true)}>
          <defs><pattern id="plan-grid-small" width="0.1" height="0.1" patternUnits="userSpaceOnUse"><path d="M .1 0 H 0 V .1" fill="none" stroke="#e3dfd5" strokeWidth="0.006" /></pattern><pattern id="plan-grid" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="url(#plan-grid-small)" /><path d="M 1 0 H 0 V 1" fill="none" stroke="#cec8ba" strokeWidth="0.012" /></pattern></defs>
          <rect x={view.x - view.width} y={view.y - view.height} width={view.width * 3} height={view.height * 3} fill="url(#plan-grid)" />
          <PlanDrawing plan={data} selected={selected} onSelect={onElementDown} dimensions={dimensions} />
          {tool === 'select' && <PlanJunctions junctions={junctions} selected={selected} view={view} interactive onSelect={onElementDown} />}
          {dimensions && <PlanDimensions plan={data} selected={selected} />}
          {magnet && magnet.type !== 'grid' && !navigating && <g pointerEvents="none"><circle cx={magnet.point.x} cy={magnet.point.y} r={magnet.radius * 1.8} fill="#e5eadf" fillOpacity="0.65" /><circle cx={magnet.point.x} cy={magnet.point.y} r={magnet.radius} fill="white" stroke="#68765d" strokeWidth="0.025" /><text x={magnet.point.x} y={magnet.point.y - magnet.radius * 2.5} textAnchor="middle" fontSize="0.17" fill="#42483e" paintOrder="stroke" stroke="#faf9f5" strokeWidth="0.06">{magnet.type === 'endpoint' ? 'Extremo' : magnet.type === 'intersection' ? 'Intersección' : 'Sobre pared'}</text></g>}
          {anchor && cursor && distance(anchor, cursor) > 0.05 && (tool === 'room' ? <rect x={Math.min(anchor.x, cursor.x)} y={Math.min(anchor.y, cursor.y)} width={Math.abs(cursor.x - anchor.x)} height={Math.abs(cursor.y - anchor.y)} fill="#e5eadf" fillOpacity="0.7" stroke="#d86d4d" strokeWidth="0.06" strokeDasharray=".12 .08" pointerEvents="none" /> : <g pointerEvents="none"><line x1={anchor.x} y1={anchor.y} x2={cursor.x} y2={cursor.y} stroke="#d86d4d" strokeWidth="0.12" strokeDasharray=".15 .08" /><text x={(anchor.x + cursor.x) / 2} y={(anchor.y + cursor.y) / 2 - 0.25} textAnchor="middle" fontSize="0.2" fill="#d86d4d">{distance(anchor, cursor).toFixed(2)} m</text></g>)}
          {anchor && <circle cx={anchor.x} cy={anchor.y} r="0.08" fill="#d86d4d" pointerEvents="none" />}
        </svg>
        {sceneMode === '2d' && anchor && cursor && <div className="pointer-events-none absolute left-4 top-20 rounded-xl border border-stone-200 bg-white/95 px-3 py-2 text-xs tabular-nums text-stone-700 shadow-sm">{tool === 'room' ? `${Math.abs(cursor.x - anchor.x).toFixed(2)} × ${Math.abs(cursor.y - anchor.y).toFixed(2)} m · ${(Math.abs(cursor.x - anchor.x) * Math.abs(cursor.y - anchor.y)).toFixed(2)} m²` : `Pared · ${distance(anchor, cursor).toFixed(2)} m`}</div>}
        {sceneMode === '3d' && <Plan3D plan={data} />}
        {!data.walls.length && !anchor && sceneMode === '2d' && <div className="pointer-events-none absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#faf9f5]/95 p-6 text-center"><Square size={28} className="mx-auto mb-3 text-olive" /><h2 className="text-lg font-semibold">Dale forma a tu casa</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">Elige Habitación y marca dos esquinas, o empieza dibujando una Pared.</p></div>}
        {sceneMode === '2d' && <><div className="absolute bottom-4 left-4 flex items-center rounded-xl border border-stone-200 bg-white shadow-sm"><button aria-label="Alejar plano" className="p-3 hover:bg-stone-50" onClick={() => zoom(1.25)}><ZoomOut size={18} /></button><span className="px-2 text-xs tabular-nums text-stone-500">{Math.round(planBounds(initial.current.data).width / view.width * 100)}%</span><button aria-label="Acercar plano" className="p-3 hover:bg-stone-50" onClick={() => zoom(0.8)}><ZoomIn size={18} /></button><button aria-label="Centrar plano" className="border-l border-stone-200 p-3 hover:bg-stone-50" onClick={() => setView(planBounds(data))}><Maximize size={17} /></button></div><button type="button" aria-label="Ajuste de precisión" aria-pressed={gridStep === 0.01} title="Alternar ajuste de 10 cm o 1 cm" onClick={() => { setGridStep(value => value === 0.1 ? 0.01 : 0.1); setMagnet(null) }} className="absolute bottom-4 right-3 min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-[11px] text-stone-600 shadow-sm hover:bg-stone-50">Ajuste · {gridStep === 0.01 ? '1 cm' : '10 cm'}</button></>}
      </div>
      <aside id="plan-properties" aria-label="Propiedades del plano" className={`${propertiesOpen ? 'block' : 'hidden'} absolute inset-x-0 bottom-0 z-20 max-h-[65%] shrink-0 space-y-5 overflow-y-auto rounded-t-2xl border-t border-stone-200 bg-white p-5 shadow-xl lg:static lg:block lg:max-h-none lg:w-72 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none`}>
        <div className="flex items-center justify-between lg:hidden"><h2 className="text-sm font-semibold">Propiedades</h2><button type="button" aria-label="Cerrar propiedades" className="rounded-lg p-3 hover:bg-stone-100" onClick={() => setPropertiesOpen(false)}><X size={18} /></button></div>
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Tu distribución</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums">{totalArea.toFixed(2)}</strong><span className="text-sm text-stone-500">m²</span></div><p className="mt-1 text-xs text-stone-500">{data.rooms.length} {data.rooms.length === 1 ? 'habitación' : 'habitaciones'} · {data.walls.length} {data.walls.length === 1 ? 'pared' : 'paredes'}</p><p className="mt-2 text-[11px] leading-relaxed text-stone-400">Superficie aproximada entre ejes de pared.</p></div>
        <div className="border-t border-stone-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold">{sceneMode === '3d' ? 'Explora tu distribución' : junction ? 'Unión de paredes' : wall ? 'Pared seleccionada' : opening ? opening.type === 'door' ? 'Puerta seleccionada' : 'Ventana seleccionada' : room ? 'Habitación seleccionada' : furniture ? 'Mueble seleccionado' : 'Cómo empezar'}</h2>
          {sceneMode === '3d' && <p className="text-sm leading-relaxed text-stone-600">Gira la vista para comprobar los volúmenes. Los huecos respetan la altura y el antepecho; recorta las paredes para ver el mobiliario. Vuelve a 2D para editar.</p>}
          {sceneMode === '2d' && <>
          {currentElement && !junction && <button type="button" aria-pressed={Boolean(currentElement.locked)} disabled={!writable} onClick={toggleLock} className={`mb-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs disabled:opacity-50 ${currentElement.locked ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}`}>{currentElement.locked ? <UnlockKeyhole size={15} /> : <LockKeyhole size={15} />}{currentElement.locked ? 'Desbloquear elemento' : 'Bloquear elemento'}</button>}
          {tool === 'furniture' && <label className="mb-4 block text-xs font-medium text-stone-600">Mueble a colocar<select aria-label="Mueble a colocar" className={inputClass} value={furnitureType} onChange={e => setFurnitureType(e.target.value)}>{Object.entries(furnitureCatalog).map(([type, item]) => <option key={type} value={type}>{item.name} · {item.width} × {item.depth} m</option>)}</select></label>}
          {!selected && <p className="text-sm leading-relaxed text-stone-600">{instructions}</p>}
          {junction && <div className="space-y-3 text-sm text-stone-600">
            <p className="font-medium text-olive">{junction.wallIds?.length || 0} paredes conectadas</p>
            <p>Arrastra este punto: todas las paredes que llegan a él permanecerán unidas.</p>
            <p className="text-xs tabular-nums">X: {junction.point.x.toFixed(2)} m · Y: {junction.point.y.toFixed(2)} m</p>
            {junction.locked && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Desbloquea las paredes conectadas antes de mover este punto.</p>}
            <p className="text-xs text-stone-500">Las uniones en T o en cruz se conservan como extremos compartidos al moverlas. Puedes deshacer el movimiento.</p>
          </div>}
          {wall && <div className="space-y-3">
            <WallMeasurements key={wall.id} wall={wall} disabled={!editable} onApply={values => {
              try { if (commit(resizeWall(data, wall.id, values))) setNotice('Medidas de pared aplicadas.'); return '' }
              catch (err) { return err.message }
            }} />
            <p className="text-xs leading-relaxed text-stone-500">Arrastra la pared para moverla. Las paredes unidas a sus extremos se ajustan con ella.</p>
          </div>}
          {opening && <div className="space-y-3">
            <NumberField label="Ancho total del hueco (m)" value={opening.width} min={0.3} max={10} disabled={!editable} onChange={width => updateOpening({ width })} />
            <NumberField label="Distancia al inicio de pared (m)" value={Number(opening.offset.toFixed(2))} min={0.05} max={100} disabled={!editable} onChange={offset => updateOpening({ offset })} />
            <p className="text-xs text-stone-500">Hasta el otro extremo: {(distance(data.walls.find(w => w.id === opening.wallId).a, data.walls.find(w => w.id === opening.wallId).b) - opening.offset - opening.width).toFixed(2)} m.</p>
            <NumberField label="Altura del hueco (m)" value={openingElevation(opening, data.walls.find(w => w.id === opening.wallId)).height} min={0.1} max={10} disabled={!editable} onChange={height => updateOpening({ height })} />
            {opening.type === 'window' && <NumberField label="Antepecho desde el suelo (m)" value={openingElevation(opening, data.walls.find(w => w.id === opening.wallId)).sill} min={0} max={10} disabled={!editable} onChange={sill => updateOpening({ sill })} />}
            {opening.type === 'door' && <label className="block text-xs font-medium text-stone-600">Tipo de puerta<select aria-label="Tipo de puerta" className={inputClass} disabled={!editable} value={opening.doorType || 'hinged'} onChange={e => updateOpening({ doorType: e.target.value })}><option value="hinged">Abatible · 1 hoja</option><option value="double">Abatible · 2 hojas</option><option value="sliding">Corredera</option></select></label>}
            {opening.type === 'window' && <label className="block text-xs font-medium text-stone-600">Tipo de ventana<select aria-label="Tipo de ventana" className={inputClass} disabled={!editable} value={opening.windowType || 'sliding'} onChange={event => updateOpening({ windowType: event.target.value })}><option value="sliding">Corredera</option><option value="casement">Abatible</option></select></label>}
            {opening.type === 'window' && opening.windowType === 'casement' && <label className="block text-xs font-medium text-stone-600">Número de hojas<select aria-label="Número de hojas" className={inputClass} disabled={!editable} value={opening.windowLeaves || 1} onChange={event => updateOpening({ windowLeaves: Number(event.target.value) })}><option value={1}>1 hoja</option><option value={2}>2 hojas</option></select></label>}
            {opening.type === 'door' && <>
              <label className="block text-xs font-medium text-stone-600">Fijo lateral<select aria-label="Fijo lateral" className={inputClass} disabled={!editable} value={opening.fixedSide || 'none'} onChange={event => {
                const fixedSide = event.target.value, count = fixedSide === 'both' ? 2 : 1
                const fixedWidth = opening.fixedWidth ?? Math.min(0.3, Math.floor((opening.width - 0.3) / count * 100 + 1e-6) / 100)
                updateOpening({ fixedSide, ...(fixedSide === 'none' ? {} : { fixedWidth }) })
              }}><option value="none">Sin fijo</option><option value="left">Izquierdo</option><option value="right">Derecho</option><option value="both">A ambos lados</option></select></label>
              {opening.fixedSide && opening.fixedSide !== 'none' && <>
                <NumberField label={opening.fixedSide === 'both' ? 'Ancho de cada fijo (m)' : 'Ancho del fijo (m)'} value={opening.fixedWidth ?? 0.3} min={0.1} max={3} disabled={!editable} onChange={fixedWidth => updateOpening({ fixedWidth })} />
                <p className="text-xs leading-relaxed text-stone-500">Hoja de puerta: {openingParts(opening).leaves[0].width.toFixed(2)} m. El ancho total incluye los fijos, marcados con F en el plano. Amplía el hueco para conservar el ancho de paso.</p>
              </>}
            </>}
            {(opening.type === 'door' || opening.windowType === 'casement') && <>
              {!(opening.type === 'window' && opening.windowLeaves === 2) && opening.doorType !== 'double' && <label className="block text-xs font-medium text-stone-600">{opening.doorType === 'sliding' ? 'Deslizamiento' : 'Bisagras'}<select aria-label={opening.doorType === 'sliding' ? 'Deslizamiento' : 'Bisagras'} className={inputClass} disabled={!editable} value={opening.hinge || 'left'} onChange={event => updateOpening({ hinge: event.target.value })}><option value="left">{opening.doorType === 'sliding' ? 'Hacia la derecha' : 'Izquierda'}</option><option value="right">{opening.doorType === 'sliding' ? 'Hacia la izquierda' : 'Derecha'}</option></select></label>}
              <Button className="w-full" variant="secondary" disabled={!editable} onClick={() => updateOpening({ flip: !opening.flip })}><RotateCcw size={16} />{opening.doorType === 'sliding' ? 'Cambiar cara de la pared' : 'Invertir sentido de apertura'}</Button>
              <p className="text-xs leading-relaxed text-stone-500">{opening.doorType === 'sliding' ? 'La flecha indica el deslizamiento. La vista 3D muestra la hoja cerrada. Comprueba el espacio lateral necesario.' : opening.windowLeaves === 2 || opening.doorType === 'double' ? 'Las dos hojas tienen bisagras en los extremos y abren hacia el mismo lado. Puedes invertir su apertura.' : 'La bisagra y el sentido se cambian por separado: puedes combinar izquierda o derecha con apertura hacia cualquiera de los dos lados de la pared.'} {opening.doorType !== 'sliding' && 'El arco muestra el recorrido.'}</p>
            </>}
            <p className="text-xs text-stone-500">Arrastra la abertura a lo largo de su pared.</p>
          </div>}
          {room && <div className="space-y-3"><label className="block text-xs font-medium text-stone-600">Nombre de habitación<input className={inputClass} value={room.name} maxLength={80} disabled={!editable} onChange={event => {
            const next = { ...data, rooms: data.rooms.map(r => r.id === room.id ? { ...r, name: event.target.value } : r) }
            // Room labels don't change geometry; keep typing as one undo action on blur.
            if (!labelBefore.current) labelBefore.current = data
            setData(next); live.current = next
          }} onBlur={finishLabel} /></label><label className="block text-xs font-medium text-stone-600">Estancia de la aplicación<select className={inputClass} value={room.roomId} disabled={!editable} onChange={event => commit({ ...data, rooms: data.rooms.map(r => r.id === room.id ? { ...r, roomId: event.target.value, name: rooms.find(item => item.id === event.target.value)?.name || r.name } : r) })}><option value="">Sin vincular</option>{rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="text-sm text-olive">{roomArea(room).toFixed(2)} m² aproximadamente</p><p className="text-xs leading-relaxed text-stone-500">Se reconoce al cerrar paredes. Al abrir o dividir el espacio, revisa los nombres y vínculos de las nuevas habitaciones.</p></div>}
          {room && <div className="mt-3 space-y-3"><p className="text-xs leading-relaxed text-stone-500">Lados interiores aproximados: {roomInteriorDimensions(data, room).map(edge => `${edge.length.toFixed(2)} m`).join(' · ')}</p><RoomActions key={room.id} disabled={!editable} mode={roomMoveMode} onMode={setRoomMoveMode} onTransform={(dx, dy, duplicate) => {
            try { const next = transformRoom(data, room.id, dx, dy, { duplicate, mode: roomMoveMode }); if (commit(next)) { setView(planBounds(next)); setNotice(duplicate ? 'Habitación duplicada con sus aberturas y muebles.' : 'Habitación desplazada.'); return '' }; return 'No se pudo aplicar el movimiento.' }
            catch (err) { return err.message }
          }} /></div>}
          {furniture && <div className="space-y-3">
            <label className="block text-xs font-medium text-stone-600">Nombre del mueble<input aria-label="Nombre del mueble" className={inputClass} maxLength={80} value={furniture.name} disabled={!editable} onChange={event => {
              if (!labelBefore.current) labelBefore.current = data
              const next = { ...data, furniture: data.furniture.map(item => item.id === furniture.id ? { ...item, name: event.target.value } : item) }
              live.current = next; setData(next)
            }} onBlur={finishLabel} /></label>
            {[['width', 'Ancho del mueble (m)', 0.1, 10], ['depth', 'Fondo del mueble (m)', 0.1, 10], ['height', 'Altura del mueble (m)', 0.1, 10], ['x', 'Posición X (m)', -500, 500], ['y', 'Posición Y (m)', -500, 500], ['rotation', 'Giro (grados)', -360, 360]].map(([key, label, min, max]) => <NumberField key={key} label={label} value={Number(furniture[key].toFixed(2))} min={min} max={max} disabled={!editable} onChange={value => updateFurniture({ [key]: value })} />)}
            <Button className="w-full" variant="secondary" disabled={!editable} onClick={() => updateFurniture({ rotation: (furniture.rotation + 90) % 360 })}><RotateCcw size={16} />Girar 90°</Button>
            {furnitureWarnings(data, furniture).map(message => <p key={message} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{message}</p>)}
            <p className="text-xs text-stone-500">Arrastra el mueble para probar otra posición. Los volúmenes son orientativos.</p>
          </div>}
          {selected && !currentElement && <p className="text-sm text-stone-500">Selecciona otro elemento del plano.</p>}
          {(wall || opening || furniture) && canEdit && <button disabled={!editable} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-terracotta disabled:opacity-50" onClick={removeSelected}><Trash2 size={16} />Eliminar {wall ? 'pared' : furniture ? 'mueble' : 'abertura'}</button>}
          </>}
        </div>
        {data.rooms.length > 0 && <div className="border-t border-stone-100 pt-4"><h3 className="mb-2 text-xs font-semibold text-stone-600">Habitaciones</h3><div className="space-y-1">{data.rooms.map(r => <button key={r.id} onClick={() => { setSelected({ kind: 'room', id: r.id }); changeTool('select') }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs ${selected?.id === r.id ? 'bg-olive-light text-olive' : 'hover:bg-stone-50'}`}><span className="truncate">{r.name || 'Sin nombre'}</span><span className="shrink-0 tabular-nums">{roomArea(r).toFixed(1)} m²</span></button>)}</div></div>}
        {data.walls.length > 0 && <details className="border-t border-stone-100 pt-4"><summary className="min-h-8 cursor-pointer text-xs font-semibold text-stone-600">Paredes · {data.walls.length}</summary><div className="mt-2 space-y-1">{data.walls.map((item, index) => <button key={item.id} type="button" onClick={() => { changeTool('select'); setSelected({ kind: 'wall', id: item.id }) }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-xs ${selected?.id === item.id ? 'bg-olive-light text-olive' : 'hover:bg-stone-50'}`}><span>Pared {index + 1}</span><span className="tabular-nums">{distance(item.a, item.b).toFixed(2)} m</span></button>)}</div></details>}
      </aside>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-2.5 text-xs leading-relaxed text-stone-500"><div>{sceneMode === '3d' ? 'Vista 3D orientativa, sin techo. Vuelve a 2D para modificar paredes, aberturas y muebles.' : anchor ? 'Marca el siguiente punto. Esc o botón derecho para terminar.' : instructions}{sceneMode === '2d' && <span className="mt-1 hidden text-[11px] sm:block">V: seleccionar · P: pared · R: habitación · H: mover · +/−: zoom · 0: centrar · Ctrl+S: guardar ? Espacio + arrastrar: mover vista ? Rueda: zoom</span>}</div>{anchor && <button type="button" className="min-h-11 shrink-0 rounded-lg bg-stone-100 px-3 font-medium text-stone-700 hover:bg-stone-200" onClick={endTrace}>Terminar trazo</button>}</footer>
    <ConfirmDialog open={confirmClose} title="Hay cambios sin guardar" message="Puedes volver al editor para guardarlos. Si sales, conservaremos un borrador en esta sesión del navegador." confirmLabel="Salir del editor" onCancel={() => setConfirmClose(false)} onConfirm={onClose} />
    <ConfirmDialog open={Boolean(pendingImport)} title="Importar distribución" message="El archivo sustituirá el dibujo actual en el editor. Puedes deshacer el cambio antes de guardar." confirmLabel="Importar plano" onCancel={() => setPendingImport(null)} onConfirm={() => { commit(pendingImport.data); setName(pendingImport.name); setView(planBounds(pendingImport.data)); setSelected(null); setAnchor(null); setPendingImport(null) }} />
  </section>
}
