import { distance, pointOnWall } from '../../utils/floorPlan'
import { roomInteriorDimensions } from '../../utils/planEditing'

function Dimension({ a, b, label }) {
  const length = distance(a, b)
  if (length < 0.15) return null
  const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length
  const x = (a.x + b.x) / 2 - dy * 0.12, y = (a.y + b.y) / 2 + dx * 0.12
  let angle = Math.atan2(dy, dx) * 180 / Math.PI
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  return <g pointerEvents="none" stroke="#9b9587" strokeWidth="0.012">
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
    {[a, b].map((p, index) => <line key={index} x1={p.x - dy * 0.06} y1={p.y + dx * 0.06} x2={p.x + dy * 0.06} y2={p.y - dx * 0.06} />)}
    <text x={x} y={y} transform={`rotate(${angle} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, sans-serif" fontSize="0.13" fill="#777568" stroke="#faf9f5" strokeWidth="0.06" paintOrder="stroke">{label || `${length.toFixed(2)} m`}</text>
  </g>
}

export default function PlanDimensions({ plan, selected, allOpenings = false }) {
  return <g data-plan-dimensions="interior">
    {plan.rooms.filter(r => !selected || selected.kind !== 'room' || selected.id === r.id).flatMap(room => roomInteriorDimensions(plan, room).map((edge, i) => {
      const dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y, length = edge.length
      const shift = p => ({ x: p.x - dy / length * 0.22, y: p.y + dx / length * 0.22 })
      return <Dimension key={`${room.id}-${i}`} a={shift(edge.a)} b={shift(edge.b)} label={`${length.toFixed(2)} m útil`} />
    }))}
    {plan.openings.filter(o => allOpenings || selected?.id === o.id).flatMap(opening => {
      const wall = plan.walls.find(w => w.id === opening.wallId)
      if (!wall) return []
      const length = distance(wall.a, wall.b), dy = (wall.b.y - wall.a.y) / length, dx = (wall.b.x - wall.a.x) / length
      const offset = value => { const p = pointOnWall(wall, value); return { x: p.x + dy * 0.4, y: p.y - dx * 0.4 } }
      return [<Dimension key={`${opening.id}-a`} a={offset(0)} b={offset(opening.offset)} />, <Dimension key={`${opening.id}-b`} a={offset(opening.offset + opening.width)} b={offset(length)} />]
    })}
  </g>
}
