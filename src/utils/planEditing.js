import { distance, projectToWall, pointOnWall, pointInPolygon, samePoint, reconcilePlan, moveJunctions, validatePlan } from './floorPlan.js'
import { furnitureCorners } from './planFurniture.js'

const translate = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy })
const edges = room => [room.points, ...(room.holes || [])].flatMap(points => points.map((a, index) => ({ a, b: points[(index + 1) % points.length] })))
const onBoundary = (wall, room) => edges(room).some(edge => projectToWall(wall.a, edge).distance < 0.001 && projectToWall(wall.b, edge).distance < 0.001)
const contains = (room, p) => pointInPolygon(p, room.points) && !(room.holes || []).some(hole => pointInPolygon(p, hole))

// Split long walls where the selected room ends. Openings crossing a cut must be
// repositioned by the user; silently splitting a real door would lose its meaning.
export function splitRoomBoundary(plan, room, makeId = () => crypto.randomUUID()) {
  const walls = [], openings = []
  for (const wall of plan.walls) {
    const length = distance(wall.a, wall.b)
    const offsets = [0, length, ...edges(room).flatMap(e => [e.a, e.b]).filter(p => projectToWall(p, wall).distance < 0.001).map(p => projectToWall(p, wall).offset)]
      .sort((a, b) => a - b).filter((value, index, array) => !index || value - array[index - 1] > 0.001)
    const hosted = plan.openings.filter(o => o.wallId === wall.id)
    if (offsets.slice(1, -1).some(cut => hosted.some(o => cut > o.offset + 1e-6 && cut < o.offset + o.width - 1e-6))) throw new Error('Una abertura atraviesa la esquina de la habitación. Muévela antes de separar o duplicar.')
    if (offsets.length > 2 && (wall.locked || hosted.some(o => o.locked))) throw new Error('Desbloquea la pared y sus aberturas antes de dividirla para mover la habitación.')
    for (let i = 1; i < offsets.length; i++) {
      const start = offsets[i - 1], end = offsets[i], id = i === 1 ? wall.id : makeId()
      walls.push({ ...wall, id, a: pointOnWall(wall, start), b: pointOnWall(wall, end) })
      for (const o of hosted.filter(o => o.offset >= start - 1e-6 && o.offset + o.width <= end + 1e-6)) openings.push({ ...o, wallId: id, offset: o.offset - start })
    }
  }
  return { ...plan, walls, openings }
}

export function transformRoom(plan, roomId, dx, dy, { duplicate = false, mode = 'detach', makeId = () => crypto.randomUUID() } = {}) {
  const room = plan.rooms.find(r => r.id === roomId)
  if (!room || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 100 || Math.abs(dy) > 100) throw new Error('El desplazamiento debe estar entre −100 y 100 metros.')
  if (Math.hypot(dx, dy) < 0.001) throw new Error('Indica un desplazamiento para mover o duplicar la habitación.')
  const split = splitRoomBoundary(plan, room, makeId), boundary = split.walls.filter(w => onBoundary(w, room)), boundaryIds = new Set(boundary.map(w => w.id))
  if (!boundary.length) throw new Error('No se encuentran las paredes de esta habitación.')
  const movingFurniture = (plan.furniture || []).filter(f => contains(room, f))
  if (!duplicate && (room.locked || boundary.some(w => w.locked) || split.openings.some(o => boundaryIds.has(o.wallId) && o.locked) || movingFurniture.some(f => f.locked))) throw new Error('Desbloquea la habitación y sus elementos antes de moverla.')
  let result
  if (!duplicate && mode === 'connected') {
    const changes = boundary.flatMap(w => [w.a, w.b]).map(from => ({ from, to: translate(from, dx, dy) }))
    result = moveJunctions(split, changes)
    result.furniture = (plan.furniture || []).map(f => movingFurniture.includes(f) ? { ...f, ...translate(f, dx, dy) } : f)
    const movedRoom = result.rooms.find(r => r.id === roomId)
    if (!movedRoom || !movedRoom.points.every((p, index) => samePoint(p, translate(room.points[index], dx, dy)))) throw new Error('El movimiento colapsa una pared conectada. Prueba otro desplazamiento o separa la habitación.')
  } else {
    const retained = new Set(boundary.filter(w => duplicate || plan.rooms.some(other => other.id !== roomId && onBoundary(w, other))).map(w => w.id))
    const idMap = new Map(boundary.map(w => [w.id, makeId()]))
    const movedRoom = { ...room, id: duplicate ? makeId() : room.id, name: duplicate ? `${room.name.slice(0, 73)} (copia)` : room.name, roomId: duplicate ? '' : room.roomId, locked: duplicate ? false : room.locked, points: room.points.map(p => translate(p, dx, dy)), holes: room.holes?.map(hole => hole.map(p => translate(p, dx, dy))) }
    result = { ...split,
      walls: [...split.walls.filter(w => !boundaryIds.has(w.id) || retained.has(w.id)), ...boundary.map(w => ({ ...w, id: idMap.get(w.id), locked: duplicate ? false : w.locked, a: translate(w.a, dx, dy), b: translate(w.b, dx, dy) }))],
      openings: [...split.openings.filter(o => !boundaryIds.has(o.wallId) || retained.has(o.wallId)), ...split.openings.filter(o => boundaryIds.has(o.wallId)).map(o => ({ ...o, id: makeId(), wallId: idMap.get(o.wallId), locked: duplicate ? false : o.locked }))],
      rooms: [...plan.rooms.filter(r => duplicate || r.id !== roomId), movedRoom],
      furniture: [...(plan.furniture || []).filter(f => duplicate || !movingFurniture.includes(f)), ...movingFurniture.map(f => ({ ...f, id: duplicate ? makeId() : f.id, locked: duplicate ? false : f.locked, ...translate(f, dx, dy) }))],
    }
    // Merging/overlapping rooms would make the result ambiguous. Keep this an
    // explicit translation, with all original and translated rooms preserved.
    result = reconcilePlan(result)
    if (!result.rooms.some(r => r.id === movedRoom.id) || plan.rooms.filter(r => duplicate || r.id !== roomId).some(r => !result.rooms.some(next => next.id === r.id))) throw new Error('La habitación se solapa con otra distribución. Elige un espacio libre.')
  }
  const extraOpenings = duplicate ? split.openings.filter(o => boundaryIds.has(o.wallId)).length : mode === 'connected' ? 0 : split.openings.filter(o => retainedShared(split, plan, roomId, o.wallId, boundaryIds)).length
  if (result.openings.length !== split.openings.length + extraOpenings) throw new Error('No hay espacio para conservar todas las aberturas. Ajusta el desplazamiento.')
  if (!validatePlan(result)) throw new Error('El desplazamiento deja medidas o aberturas no válidas. Separa más la copia o ajusta las uniones.')
  const problem = lockedChangeError(plan, result)
  if (problem) throw new Error(problem)
  return result
}
function retainedShared(split, plan, roomId, wallId, ids) {
  const wall = split.walls.find(w => w.id === wallId)
  return ids.has(wallId) && plan.rooms.some(r => r.id !== roomId && onBoundary(wall, r))
}

export function lockedChangeError(before, after) {
  const shape = (kind, item) => {
    const { locked, ...rest } = item
    if (kind === 'rooms') return JSON.stringify({ points: item.points, holes: item.holes || [] })
    return JSON.stringify(rest)
  }
  for (const kind of ['walls', 'openings', 'rooms', 'furniture']) for (const item of before[kind] || []) {
    if (!item.locked) continue
    const next = (after[kind] || []).find(o => o.id === item.id)
    if (!next || shape(kind, item) !== shape(kind, next)) return 'El cambio afecta a un elemento bloqueado. Desbloquéalo primero.'
    if (kind === 'openings') {
      const oldWall = before.walls.find(w => w.id === item.wallId), newWall = after.walls.find(w => w.id === item.wallId)
      if (!newWall || !samePoint(oldWall.a, newWall.a) || !samePoint(oldWall.b, newWall.b)) return 'El cambio movería una abertura bloqueada. Desbloquéala primero.'
    }
  }
  return ''
}

export function roomInteriorDimensions(plan, room) {
  // Offset each polygon edge inward by half its host wall thickness. Adjacent
  // offset lines meet at the interior corner (also works for rotated rooms).
  const points = room.points
  const lines = points.map((a, index) => {
    const b = points[(index + 1) % points.length], length = distance(a, b)
    const host = plan.walls.find(w => projectToWall(a, w).distance < 0.001 && projectToWall(b, w).distance < 0.001)
    const t = (host?.thickness || 0.15) / 2, normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
    return { a: translate(a, normal.x * t, normal.y * t), b: translate(b, normal.x * t, normal.y * t) }
  })
  const interior = lines.map((line, i) => {
    const previous = lines[(i + lines.length - 1) % lines.length], rx = line.b.x - line.a.x, ry = line.b.y - line.a.y, sx = previous.b.x - previous.a.x, sy = previous.b.y - previous.a.y, denominator = rx * sy - ry * sx
    if (Math.abs(denominator) < 1e-8) return line.a
    const t = ((previous.a.x - line.a.x) * sy - (previous.a.y - line.a.y) * sx) / denominator
    return { x: line.a.x + rx * t, y: line.a.y + ry * t }
  })
  return interior.map((a, i) => ({ a, b: interior[(i + 1) % interior.length], length: distance(a, interior[(i + 1) % interior.length]) }))
}

export function furnitureWarnings(plan, item) {
  const corners = furnitureCorners(item)
  const fits = plan.rooms.some(room => corners.every(p => contains(room, p)))
  const hitsWall = plan.walls.some(wall => {
    // Local coordinates, then line vs rectangle (slab intersection).
    const angle = -item.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle)
    const local = p => ({ x: (p.x - item.x) * c - (p.y - item.y) * s, y: (p.x - item.x) * s + (p.y - item.y) * c })
    const a = local(wall.a), b = local(wall.b), half = [item.width / 2 + wall.thickness / 2, item.depth / 2 + wall.thickness / 2]
    let low = 0, high = 1
    for (const [i, key] of ['x', 'y'].entries()) {
      const delta = b[key] - a[key]
      if (Math.abs(delta) < 1e-8) { if (Math.abs(a[key]) > half[i]) return false }
      else { const t1 = (-half[i] - a[key]) / delta, t2 = (half[i] - a[key]) / delta; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); if (low > high) return false }
    }
    return true
  })
  return [!fits && 'El mueble sobresale de una habitación cerrada.', hitsWall && 'El mueble intersecta una pared.'].filter(Boolean)
}
