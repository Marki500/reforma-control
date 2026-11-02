import { distance, drawingTargets, projectToWall, samePoint, openingElevation, openingParts, openingLeaf } from './floorPlan.js'

// Rectangular wall ends stop at their axes, leaving the outside of a corner
// empty. Fill that sector with a shared mitre (or a bounded bevel at sharp angles).
export function wallCornerJoins(plan) {
  const joins = [], turn = Math.PI * 2
  for (const { point } of drawingTargets(plan.walls)) {
    const rays = []
    for (const wall of plan.walls) {
      if (projectToWall(point, wall).distance > 0.001) continue
      for (const end of [wall.a, wall.b]) {
        if (samePoint(point, end)) continue
        const length = distance(point, end), dx = (end.x - point.x) / length, dy = (end.y - point.y) / length
        const angle = (Math.atan2(dy, dx) + turn) % turn
        const duplicate = rays.find(ray => Math.abs(ray.dx - dx) + Math.abs(ray.dy - dy) < 1e-6)
        if (duplicate) { duplicate.half = Math.max(duplicate.half, wall.thickness / 2); duplicate.height = Math.max(duplicate.height, wall.height) }
        else rays.push({ dx, dy, angle, half: wall.thickness / 2, height: wall.height })
      }
    }
    rays.sort((a, b) => a.angle - b.angle)
    if (rays.length < 2) continue
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i], b = rays[(i + 1) % rays.length]
      const gap = (b.angle - a.angle + turn) % turn
      if (gap <= Math.PI + 1e-6) continue
      const cross = a.dx * b.dy - a.dy * b.dx
      if (Math.abs(cross) < 1e-6) continue
      const left = { x: -a.dy * a.half, y: a.dx * a.half }
      const right = { x: b.dy * b.half, y: -b.dx * b.half }
      const along = ((right.x - left.x) * b.dy - (right.y - left.y) * b.dx) / cross
      const tip = { x: left.x + along * a.dx, y: left.y + along * a.dy }
      const offsets = [left]
      const bevel = Math.hypot(tip.x, tip.y) > 4 * Math.max(a.half, b.half)
      if (!bevel) offsets.push(tip)
      offsets.push(right, { x: 0, y: 0 })
      joins.push({ point, points: offsets.map(p => ({ x: point.x + p.x, y: point.y + p.y })), height: Math.min(a.height, b.height), bevel })
    }
  }
  return joins
}

// Solid wall volumes exclude the complete opening, including its sill/lintel.
export function wallSolidSections(wall, openings) {
  const result = [], length = distance(wall.a, wall.b)
  const add = (start, width, base, height) => { if (width > 1e-6 && height > 1e-6) result.push({ start, width, base, height }) }
  let cursor = 0
  for (const opening of openings.filter(o => o.wallId === wall.id).sort((a, b) => a.offset - b.offset)) {
    const { sill, height } = openingElevation(opening, wall)
    add(cursor, opening.offset - cursor, 0, wall.height)
    add(opening.offset, opening.width, 0, sill)
    add(opening.offset, opening.width, sill + height, wall.height - sill - height)
    cursor = opening.offset + opening.width
  }
  add(cursor, length - cursor, 0, wall.height)
  return result
}

export function buildPlanScene(THREE, plan, { cutaway = false } = {}) {
  const root = new THREE.Group(), clipped = cutaway ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1)] : []
  const material = (color, opacity = 1, clip = false) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: opacity < 1, opacity, side: THREE.DoubleSide, clippingPlanes: clip ? clipped : [] })
  const plaster = material('#e3dfd3', 1, true), glass = material('#a9c7d0', 0.52), frame = material('#787d71'), wood = material('#b69976'), floorColors = ['#d8ccba', '#c9d1be', '#ddcbb8']
  function box(parent, x, y, z, w, h, d, mat) {
    if (cutaway && parent.userData.cutBase !== undefined) {
      const bottom = y - h / 2
      h = Math.min(h, 1 - parent.userData.cutBase - bottom); y = bottom + h / 2
    }
    if (w <= 0 || h <= 0 || d <= 0) return
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z); parent.add(mesh); return mesh
  }
  for (const [index, room] of plan.rooms.entries()) {
    const shape = new THREE.Shape(room.points.map(p => new THREE.Vector2(p.x, -p.y)))
    for (const hole of room.holes || []) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p.x, -p.y))))
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2)
    root.add(new THREE.Mesh(geometry, material(floorColors[index % 3])))
  }
  for (const wall of plan.walls) {
    const group = new THREE.Group(); group.userData.cutBase = 0; group.position.set(wall.a.x, 0, wall.a.y); group.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x); root.add(group)
    for (const section of wallSolidSections(wall, plan.openings)) box(group, section.start + section.width / 2, section.base + section.height / 2, 0, section.width, section.height, wall.thickness, plaster)
    for (const opening of plan.openings.filter(o => o.wallId === wall.id)) {
      const { sill, height } = openingElevation(opening, wall), parts = openingParts(opening), isWindow = opening.type === 'window'
      const trim = 0.035
      for (const x of [opening.offset, opening.offset + opening.width]) box(group, x, sill + height / 2, 0, trim, height, wall.thickness + 0.025, frame)
      for (const y of [sill, sill + height]) box(group, opening.offset + opening.width / 2, y, 0, opening.width, trim, wall.thickness + 0.025, frame)
      for (const fixed of parts.fixed) box(group, fixed.offset + fixed.width / 2, sill + height / 2, 0, fixed.width, height, 0.025, glass)
      if (isWindow && opening.windowType !== 'casement') {
        box(group, opening.offset + opening.width / 2, sill + height / 2, 0, opening.width, height, 0.025, glass)
        box(group, opening.offset + opening.width / 2, sill + height / 2, 0, trim, height, 0.05, frame)
      } else if (opening.doorType === 'sliding') {
        const leaf = parts.leaves[0]
        box(group, leaf.offset + leaf.width / 2, height / 2, opening.flip ? -0.04 : 0.04, leaf.width, height, 0.04, wood)
      } else for (const part of parts.leaves) {
        const leaf = openingLeaf(part, isWindow ? Math.PI / 3 : Math.PI / 2)
        const pivot = new THREE.Group(); pivot.userData.cutBase = sill; pivot.position.set(leaf.hinge, sill, 0)
        const direction = part.hinge === 'right' ? -1 : 1
        pivot.rotation.y = -Math.atan2(leaf.y, leaf.x - leaf.hinge)
        group.add(pivot)
        box(pivot, part.width / 2, height / 2, 0, part.width, height, isWindow ? 0.025 : 0.04, isWindow ? glass : wood)
        if (isWindow) {
          for (const x of [0, part.width]) box(pivot, x, height / 2, 0, trim, height, 0.04, frame)
          for (const y of [0, height]) box(pivot, part.width / 2, y, 0, part.width, trim, 0.04, frame)
        } else box(pivot, part.width * 0.88, 1, direction * 0.04, 0.1, 0.025, 0.06, frame)
      }
    }
  }
  for (const join of wallCornerJoins(plan)) {
    const height = Math.min(join.height, cutaway ? 1 : join.height)
    const shape = new THREE.Shape(join.points.map(p => new THREE.Vector2(p.x, -p.y)))
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    geometry.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geometry, plaster)
    mesh.userData.wallCornerJoin = true
    root.add(mesh)
  }
  for (const f of plan.furniture || []) {
    const group = new THREE.Group(); group.position.set(f.x, 0.015, f.y); group.rotation.y = -f.rotation * Math.PI / 180; root.add(group)
    const mat = material(({ sofa: '#8b967d', bed: '#c4b49d', table: '#b79470', wardrobe: '#c1b6a5', chair: '#9c8876' })[f.type]), fabric = material('#f0ece3')
    if (f.type === 'table') {
      box(group, 0, f.height - 0.04, 0, f.width, 0.08, f.depth, mat)
      for (const x of [-1, 1]) for (const z of [-1, 1]) box(group, x * (f.width / 2 - 0.07), (f.height - 0.08) / 2, z * (f.depth / 2 - 0.07), 0.06, f.height - 0.08, 0.06, mat)
    } else if (f.type === 'bed') {
      box(group, 0, f.height * 0.3, 0, f.width, f.height * 0.6, f.depth, mat)
      box(group, 0, f.height * 0.8, 0, f.width * 0.97, f.height * 0.4, f.depth * 0.97, fabric)
      box(group, 0, f.height * 1.02, -f.depth * 0.32, f.width * 0.85, 0.08, f.depth * 0.2, fabric)
    } else if (f.type === 'sofa' || f.type === 'chair') {
      box(group, 0, f.height * 0.3, 0, f.width, f.height * 0.6, f.depth, mat)
      box(group, 0, f.height * 0.8, -f.depth * 0.4, f.width, f.height * 0.4, f.depth * 0.2, mat)
      for (const x of [-1, 1]) box(group, x * (f.width / 2 - 0.05), f.height * 0.65, 0, 0.1, f.height * 0.3, f.depth, mat)
    } else box(group, 0, f.height / 2, 0, f.width, f.height, f.depth, mat)
  }
  return root
}

export function disposeScene(root) {
  const geometries = new Set(), materials = new Set()
  root.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const mat of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) materials.add(mat) })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
}
