// Coordinates, widths and heights are expressed in metres.
export const GRID = 0.1
export const emptyPlan = () => ({ version: 1, walls: [], openings: [], rooms: [] })
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
export const snap = point => ({ x: Math.round(point.x / GRID) * GRID, y: Math.round(point.y / GRID) * GRID })
export const samePoint = (a, b) => distance(a, b) < 0.001
const key = p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`
const cross = (a, b) => a.x * b.y - a.y * b.x
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
export const pointOnWall = (wall, offset) => {
  const length = distance(wall.a, wall.b)
  return { x: wall.a.x + (wall.b.x - wall.a.x) * offset / length, y: wall.a.y + (wall.b.y - wall.a.y) * offset / length }
}
export function projectToWall(point, wall) {
  const vector = sub(wall.b, wall.a), length = distance(wall.a, wall.b)
  if (length < 0.001) return { point: wall.a, offset: 0, distance: distance(point, wall.a) }
  const offset = Math.max(0, Math.min(length, (sub(point, wall.a).x * vector.x + sub(point, wall.a).y * vector.y) / length))
  const projected = pointOnWall(wall, offset)
  return { point: projected, offset, distance: distance(point, projected) }
}
export function drawingPoint(point, walls, anchor) {
  let result = snap(point)
  const ends = walls.flatMap(wall => [wall.a, wall.b])
  const nearest = ends.find(end => distance(end, result) < 0.18)
  if (nearest) result = { ...nearest }
  if (anchor) {
    result = Math.abs(result.x - anchor.x) >= Math.abs(result.y - anchor.y)
      ? { x: result.x, y: anchor.y } : { x: anchor.x, y: result.y }
  }
  return result
}
export function polygonArea(points) {
  return points.reduce((sum, p, index) => sum + cross(p, points[(index + 1) % points.length]), 0) / 2
}
export function polygonCenter(points) {
  const area = polygonArea(points)
  if (Math.abs(area) < 0.001) return points[0]
  return points.reduce((center, p, index) => {
    const q = points[(index + 1) % points.length], factor = cross(p, q) / (6 * area)
    return { x: center.x + (p.x + q.x) * factor, y: center.y + (p.y + q.y) * factor }
  }, { x: 0, y: 0 })
}
export function pointInPolygon(point, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if (projectToWall(point, { a, b }).distance < 1e-6) return false
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
export const roomArea = room => polygonArea(room.points) - (room.holes || []).reduce((sum, points) => sum + polygonArea(points), 0)
export function roomCenter(room) {
  const center = polygonCenter(room.points)
  const contains = p => pointInPolygon(p, room.points) && !(room.holes || []).some(hole => pointInPolygon(p, hole))
  if (contains(center)) return center
  const xs = room.points.map(p => p.x), ys = room.points.map(p => p.y), candidates = []
  for (let x = 1; x < 10; x++) for (let y = 1; y < 10; y++) {
    const p = { x: Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * x / 10, y: Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * y / 10 }
    if (contains(p)) candidates.push(p)
  }
  return candidates.sort((a, b) => distance(a, center) - distance(b, center))[0] || center
}
const polygonKey = points => points.map(key).sort().join('|')

// Build the planar graph, splitting edges at intersections and T junctions,
// then walk its bounded faces. This also detects rooms divided by a new wall.
export function detectRooms(walls, previous = [], makeId = () => crypto.randomUUID()) {
  const graph = new Map(), points = new Map()
  function edge(a, b) {
    if (samePoint(a, b)) return
    const ka = key(a), kb = key(b)
    points.set(ka, a); points.set(kb, b)
    if (!graph.has(ka)) graph.set(ka, new Set())
    if (!graph.has(kb)) graph.set(kb, new Set())
    graph.get(ka).add(kb); graph.get(kb).add(ka)
  }
  for (const wall of walls) {
    const cuts = [wall.a, wall.b], r = sub(wall.b, wall.a)
    for (const other of walls) {
      if (wall.id === other.id) continue
      const s = sub(other.b, other.a), denominator = cross(r, s), delta = sub(other.a, wall.a)
      if (Math.abs(denominator) > 1e-8) {
        const t = cross(delta, s) / denominator, u = cross(delta, r) / denominator
        if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) cuts.push({ x: wall.a.x + t * r.x, y: wall.a.y + t * r.y })
      } else {
        for (const p of [other.a, other.b]) if (projectToWall(p, wall).distance < 0.001) cuts.push(p)
      }
    }
    cuts.sort((a, b) => distance(wall.a, a) - distance(wall.a, b))
    for (let i = 1; i < cuts.length; i++) edge(cuts[i - 1], cuts[i])
  }
  const neighbors = new Map([...graph].map(([k, values]) => [k, [...values].sort((a, b) => {
    const p = points.get(k), pa = points.get(a), pb = points.get(b)
    return Math.atan2(pa.y - p.y, pa.x - p.x) - Math.atan2(pb.y - p.y, pb.x - p.x)
  })]))
  const seen = new Set(), rooms = []
  for (const [start, targets] of neighbors) for (const target of targets) {
    if (seen.has(`${start}>${target}`)) continue
    const polygon = []
    let a = start, b = target
    for (let guard = 0; guard < walls.length * walls.length * 4 + 8; guard++) {
      if (seen.has(`${a}>${b}`)) break
      seen.add(`${a}>${b}`); polygon.push(points.get(a))
      const around = neighbors.get(b), next = around[(around.indexOf(a) - 1 + around.length) % around.length]
      a = b; b = next
      if (a === start && b === target) break
    }
    // Drop collinear vertices so a harmless T junction doesn't rename a room.
    const simplified = polygon.filter((p, i) => Math.abs(cross(sub(p, polygon[(i + polygon.length - 1) % polygon.length]), sub(polygon[(i + 1) % polygon.length], p))) > 1e-6)
    if (simplified.length < 3 || polygonArea(simplified) < 0.25) continue
    const existing = previous.find(room => polygonKey(room.points) === polygonKey(simplified))
    rooms.push({ id: existing?.id || makeId(), name: existing?.name || `Habitación ${rooms.length + 1}`, roomId: existing?.roomId || '', points: simplified })
  }
  // A disconnected inner enclosure takes area out of its surrounding room.
  for (const child of rooms) {
    const parent = rooms.filter(candidate => candidate !== child && child.points.every(p => pointInPolygon(p, candidate.points)))
      .sort((a, b) => polygonArea(a.points) - polygonArea(b.points))[0]
    if (parent) (parent.holes ||= []).push(child.points)
  }
  return rooms
}

export function addWall(plan, a, b, makeId = () => crypto.randomUUID()) {
  if (distance(a, b) < 0.2 || plan.walls.length >= 200) return plan
  // Ignore an edge already covered by a collinear wall.
  if (plan.walls.some(wall => projectToWall(a, wall).distance < 0.001 && projectToWall(b, wall).distance < 0.001)) return plan
  return { ...plan, walls: [...plan.walls, { id: makeId(), a, b, thickness: 0.15, height: 2.5 }] }
}
export function fitOpening(plan, wallId, offset, width, excludeId) {
  const wall = plan.walls.find(item => item.id === wallId)
  if (!wall || !Number.isFinite(width) || width < 0.3 || width > distance(wall.a, wall.b) - 0.1) return null
  const start = Math.max(0.05, Math.min(distance(wall.a, wall.b) - width - 0.05, offset))
  if (plan.openings.some(item => item.id !== excludeId && item.wallId === wallId && start < item.offset + item.width + 0.05 && start + width + 0.05 > item.offset)) return null
  return { offset: Math.round(start * 1000) / 1000, width }
}
export function reconcilePlan(plan) {
  const openings = []
  for (const opening of plan.openings) {
    const fit = fitOpening({ ...plan, openings }, opening.wallId, opening.offset, opening.width)
    if (fit) openings.push({ ...opening, ...fit })
  }
  return { ...plan, openings, rooms: detectRooms(plan.walls, plan.rooms) }
}
export function moveJunctions(plan, changes) {
  const walls = plan.walls.map(wall => ({ ...wall,
    a: changes.find(change => samePoint(change.from, wall.a))?.to || wall.a,
    b: changes.find(change => samePoint(change.from, wall.b))?.to || wall.b,
  }))
  if (walls.some(wall => distance(wall.a, wall.b) < 0.2)) return plan
  const rooms = plan.rooms.map(room => ({ ...room, points: room.points.map(p => changes.find(change => samePoint(change.from, p))?.to || p) }))
  return reconcilePlan({ ...plan, walls, rooms })
}
export function wallEndpointChanges(plan, wall, a, b) {
  const points = [...plan.walls.flatMap(item => [item.a, item.b]), ...plan.rooms.flatMap(room => room.points)]
  return points.filter(p => projectToWall(p, wall).distance < 0.001).map(from => {
    const fraction = projectToWall(from, wall).offset / distance(wall.a, wall.b)
    return { from, to: { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction } }
  })
}
export function validatePlan(plan) {
  if (plan?.version !== 1 || !Array.isArray(plan.walls) || !Array.isArray(plan.openings) || !Array.isArray(plan.rooms) || plan.walls.length > 200 || plan.openings.length > 200 || plan.rooms.length > 200) return false
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 500 && Math.abs(p.y) <= 500
  const ids = new Set()
  for (const item of [...plan.walls, ...plan.openings, ...plan.rooms]) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || ids.has(item.id)) return false
    ids.add(item.id)
  }
  return plan.walls.every(w => validPoint(w.a) && validPoint(w.b) && distance(w.a, w.b) >= 0.2 && Number.isFinite(w.thickness) && w.thickness >= 0.05 && w.thickness <= 1 && Number.isFinite(w.height) && w.height >= 1 && w.height <= 10)
    && plan.openings.every(o => ['door', 'window'].includes(o.type) && Number.isFinite(o.offset) && o.offset >= 0.05 - 1e-6 && fitOpening(plan, o.wallId, o.offset, o.width, o.id) && Math.abs(fitOpening(plan, o.wallId, o.offset, o.width, o.id).offset - o.offset) < 0.001)
    && plan.rooms.every(r => typeof r.name === 'string' && r.name.length <= 80 && Array.isArray(r.points) && r.points.length >= 3 && r.points.length <= 400 && r.points.every(validPoint) && (r.holes === undefined || (Array.isArray(r.holes) && r.holes.length <= 200 && r.holes.every(hole => Array.isArray(hole) && hole.length >= 3 && hole.length <= 400 && hole.every(validPoint)))))
}

export function examplePlan() {
  let plan = emptyPlan()
  const corners = [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }]
  for (let i = 0; i < 4; i++) plan = addWall(plan, corners[i], corners[(i + 1) % 4])
  plan = addWall(plan, { x: 5.5, y: 2 }, { x: 5.5, y: 6 })
  plan.rooms = detectRooms(plan.walls)
  plan.rooms[0].name = 'Salón'
  plan.rooms[1].name = 'Dormitorio'
  plan.openings = [
    { id: crypto.randomUUID(), wallId: plan.walls[3].id, type: 'door', offset: 0.7, width: 0.9, flip: true },
    { id: crypto.randomUUID(), wallId: plan.walls[4].id, type: 'door', offset: 2.6, width: 0.8, flip: true },
    { id: crypto.randomUUID(), wallId: plan.walls[0].id, type: 'window', offset: 0.9, width: 1.4, flip: false },
    { id: crypto.randomUUID(), wallId: plan.walls[1].id, type: 'window', offset: 1, width: 1.2, flip: false },
  ]
  return plan
}
export function planBounds(plan) {
  const points = plan.walls.flatMap(wall => [wall.a, wall.b])
  if (!points.length) return { x: 0, y: 0, width: 16, height: 11 }
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  return { x: Math.min(...xs) - 1.5, y: Math.min(...ys) - 1.5, width: Math.max(6, Math.max(...xs) - Math.min(...xs) + 3), height: Math.max(5, Math.max(...ys) - Math.min(...ys) + 3) }
}
