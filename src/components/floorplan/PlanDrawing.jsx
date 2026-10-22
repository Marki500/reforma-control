import { distance, roomArea, roomCenter } from '../../utils/floorPlan'

export default function PlanDrawing({ plan, selected, onSelect, dimensions = true }) {
  const pick = (event, kind, id) => onSelect?.(event, { kind, id })
  return <>
    {plan.rooms.map((room, index) => {
      const center = roomCenter(room), active = selected?.id === room.id
      const path = [room.points, ...(room.holes || [])].map(points => `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`).join(' ')
      return <g key={room.id} data-plan-kind="room" data-plan-id={room.id} onPointerDown={event => pick(event, 'room', room.id)}>
        <path d={path} fillRule="evenodd" fill={active ? '#e5eadf' : ['#f0ede5', '#edf0e8', '#f6eee5'][index % 3]} stroke={active ? '#68765d' : 'none'} strokeWidth="0.04" />
        <text x={center.x} y={center.y - 0.05} textAnchor="middle" fontSize="0.22" fill="#42483e" fontWeight="600" pointerEvents="none">{room.name}</text>
        <text x={center.x} y={center.y + 0.25} textAnchor="middle" fontSize="0.18" fill="#777568" pointerEvents="none">{roomArea(room).toFixed(2)} m²</text>
      </g>
    })}
    {plan.walls.map(wall => {
      const active = selected?.id === wall.id, length = distance(wall.a, wall.b)
      const vertical = Math.abs(wall.b.y - wall.a.y) > Math.abs(wall.b.x - wall.a.x)
      return <g key={wall.id} data-plan-kind="wall" data-plan-id={wall.id} onPointerDown={event => pick(event, 'wall', wall.id)}>
        <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke="transparent" strokeWidth="0.35" />
        <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke={active ? '#d86d4d' : '#42483e'} strokeWidth={wall.thickness} strokeLinecap="square" />
        {dimensions && <text x={(wall.a.x + wall.b.x) / 2 + (vertical ? 0.25 : 0)} y={(wall.a.y + wall.b.y) / 2 - (vertical ? 0 : 0.23)} textAnchor="middle" fontSize="0.16" fill="#777568" paintOrder="stroke" stroke="#faf9f5" strokeWidth="0.07" strokeLinejoin="round" pointerEvents="none">{length.toFixed(2)} m</text>}
        {active && [wall.a, wall.b].map((p, index) => <circle key={index} cx={p.x} cy={p.y} r="0.09" fill="white" stroke="#d86d4d" strokeWidth="0.04" />)}
      </g>
    })}
    {plan.openings.map(opening => {
      const wall = plan.walls.find(w => w.id === opening.wallId)
      if (!wall) return null
      const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180 / Math.PI
      const length = distance(wall.a, wall.b), start = opening.offset
      const active = selected?.id === opening.id, color = active ? '#d86d4d' : opening.type === 'window' ? '#64748b' : '#68765d'
      const side = opening.flip ? -1 : 1, width = opening.width
      return <g key={opening.id} data-plan-kind="opening" data-plan-id={opening.id} transform={`translate(${wall.a.x} ${wall.a.y}) rotate(${angle})`} onPointerDown={event => pick(event, 'opening', opening.id)}>
        <line x1={start} y1="0" x2={Math.min(length, start + width)} y2="0" stroke="#faf9f5" strokeWidth={wall.thickness + 0.045} />
        {opening.type === 'window' ? <>
          <rect x={start} y={-wall.thickness / 2} width={width} height={wall.thickness} fill="#e6edf0" stroke={color} strokeWidth="0.035" />
          <line x1={start} y1="0" x2={start + width} y2="0" stroke={color} strokeWidth="0.025" />
        </> : <>
          <line x1={start} y1="0" x2={start} y2={side * width} stroke={color} strokeWidth="0.045" />
          <path d={`M ${start + width} 0 A ${width} ${width} 0 0 ${side > 0 ? 1 : 0} ${start} ${side * width}`} fill="none" stroke={color} strokeWidth="0.025" />
        </>}
        <rect x={start - 0.05} y={-0.18} width={width + 0.1} height="0.36" fill="transparent" />
      </g>
    })}
  </>
}
