import { distance, openingLeaf, openingParts, roomArea, roomCenter } from '../../utils/floorPlan'
import { furnitureCatalog } from '../../utils/planFurniture'

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
        {active && [wall.a, wall.b].map((p, index) => <g key={index} pointerEvents="none"><circle cx={p.x} cy={p.y} r="0.09" fill="white" stroke="#d86d4d" strokeWidth="0.04" /><text x={p.x} y={p.y - 0.2} textAnchor="middle" fontSize="0.16" fill="#d86d4d" paintOrder="stroke" stroke="#faf9f5" strokeWidth="0.06">{index ? 'B' : 'A'}</text></g>)}
      </g>
    })}
    {plan.openings.map(opening => {
      const wall = plan.walls.find(w => w.id === opening.wallId)
      if (!wall) return null
      const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180 / Math.PI
      const length = distance(wall.a, wall.b), start = opening.offset
      const active = selected?.id === opening.id, color = active ? '#d86d4d' : opening.type === 'window' ? '#64748b' : '#68765d'
      const width = opening.width, sliding = opening.type === 'window' && opening.windowType !== 'casement'
      const parts = openingParts(opening), leaves = parts.leaves.map(item => openingLeaf(item, opening.type === 'window' ? Math.PI / 3 : Math.PI / 2))
      const description = opening.type === 'door' ? `Puerta${opening.doorType === 'sliding' ? ' corredera' : opening.doorType === 'double' ? ' de doble hoja' : ''}${parts.fixed.length ? ` con ${parts.fixed.length === 2 ? 'dos fijos laterales' : `fijo ${opening.fixedSide === 'left' ? 'izquierdo' : 'derecho'}`}` : ''}` : sliding ? 'Ventana corredera' : `Ventana abatible · ${leaves.length === 2 ? '2 hojas' : '1 hoja'}`
      return <g key={opening.id} data-plan-kind="opening" data-plan-id={opening.id} transform={`translate(${wall.a.x} ${wall.a.y}) rotate(${angle})`} onPointerDown={event => pick(event, 'opening', opening.id)}>
        <title>{`${description}${sliding || leaves.length === 2 ? '' : ` · Bisagra ${opening.hinge === 'right' ? 'derecha' : 'izquierda'}`}`}</title>
        <line x1={start} y1="0" x2={Math.min(length, start + width)} y2="0" stroke="#faf9f5" strokeWidth={wall.thickness + 0.045} />
        {opening.type === 'window' ? <>
          <rect x={start} y={-wall.thickness / 2} width={width} height={wall.thickness} fill="#e6edf0" stroke={color} strokeWidth="0.035" />
          {sliding ? <>
            <line x1={start} y1={-wall.thickness * 0.2} x2={start + width * 0.55} y2={-wall.thickness * 0.2} stroke={color} strokeWidth="0.035" />
            <line x1={start + width * 0.45} y1={wall.thickness * 0.2} x2={start + width} y2={wall.thickness * 0.2} stroke={color} strokeWidth="0.035" />
            <path d={`M ${start + width * 0.18} -0.2 h ${width * 0.22} m -0.07 -0.05 l 0.07 0 l -0.07 0.05 M ${start + width * 0.82} 0.2 h ${-width * 0.22} m 0.07 -0.05 l -0.07 0 l 0.07 0.05`} fill="none" stroke={color} strokeWidth="0.025" />
          </> : <>
            {leaves.map((leaf, index) => <g key={index} data-opening-leaf="window"><line x1={leaf.hinge} y1="0" x2={leaf.x} y2={leaf.y} stroke={color} strokeWidth="0.035" /><path d={leaf.arc} fill="none" stroke={color} strokeWidth="0.02" strokeDasharray=".06 .04" /><circle cx={leaf.hinge} cy="0" r="0.04" fill={color} /></g>)}
            {leaves.length === 2 && <line x1={start + width / 2} y1={-wall.thickness / 2} x2={start + width / 2} y2={wall.thickness / 2} stroke={color} strokeWidth="0.045" />}
          </>}
        </> : <>
          {parts.fixed.map((panel, index) => <g key={index} data-opening-fixed="true"><rect x={panel.offset} y={-wall.thickness / 2} width={panel.width} height={wall.thickness} fill="#e6edf0" stroke={color} strokeWidth="0.035" /><line x1={panel.offset} y1="0" x2={panel.offset + panel.width} y2="0" stroke={color} strokeWidth="0.025" /><text x={panel.offset + panel.width / 2} y={-wall.thickness / 2 - 0.08} textAnchor="middle" fontSize="0.13" fill={color} pointerEvents="none">F</text></g>)}
          {opening.doorType === 'sliding' ? <g data-opening-leaf="sliding-door"><rect x={parts.leaves[0].offset} y={-0.035} width={parts.leaves[0].width} height="0.07" fill="#e5dfd1" stroke={color} strokeWidth="0.025" /><path d={`M ${parts.leaves[0].offset + width * 0.2} ${opening.flip ? -0.22 : 0.22} h ${width * (opening.hinge === 'right' ? -0.35 : 0.35)}`} stroke={color} strokeWidth="0.025" /><text x={start + width / 2} y={opening.flip ? -0.25 : 0.3} textAnchor="middle" fontSize="0.18" fill={color} pointerEvents="none">{opening.hinge === 'right' ? '←' : '→'}</text></g> : leaves.map((leaf, index) => <g key={index} data-opening-leaf="door"><line x1={leaf.hinge} y1="0" x2={leaf.x} y2={leaf.y} stroke={color} strokeWidth="0.045" /><path d={leaf.arc} fill="none" stroke={color} strokeWidth="0.025" /></g>)}
        </>}
        <rect x={start - 0.05} y={-0.18} width={width + 0.1} height="0.36" fill="transparent" />
      </g>
    })}
    {(plan.furniture || []).map(item => {
      const active = selected?.id === item.id, color = furnitureCatalog[item.type]?.color || '#b5aa96', w = item.width, d = item.depth
      return <g key={item.id} data-plan-kind="furniture" data-plan-id={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`} onPointerDown={event => pick(event, 'furniture', item.id)}>
        <title>{item.name}{item.locked ? ' · Bloqueado' : ''} · {w.toFixed(2)} × {d.toFixed(2)} m</title>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx="0.045" fill={color} fillOpacity="0.75" stroke={active ? '#d86d4d' : '#746d60'} strokeWidth={active ? '0.045' : '0.02'} strokeDasharray={item.locked ? '.05 .04' : undefined} />
        {item.type === 'bed' && <><rect x={-w / 2 + 0.06} y={-d / 2 + 0.08} width={w - 0.12} height={d * 0.18} rx="0.03" fill="#faf9f5" stroke="#9b9587" strokeWidth="0.015" /><line x1={-w / 2} y1={-d * 0.15} x2={w / 2} y2={-d * 0.15} stroke="#9b9587" strokeWidth="0.02" /></>}
        {(item.type === 'sofa' || item.type === 'chair') && <><rect x={-w / 2 + 0.07} y={-d / 2 + 0.06} width={w - 0.14} height={d * 0.22} rx="0.03" fill={color} stroke="#746d60" strokeWidth="0.015" /><line x1={-w / 2 + 0.12} y1={-d / 2 + d * 0.28} x2={-w / 2 + 0.12} y2={d / 2} stroke="#746d60" strokeWidth="0.02" /><line x1={w / 2 - 0.12} y1={-d / 2 + d * 0.28} x2={w / 2 - 0.12} y2={d / 2} stroke="#746d60" strokeWidth="0.02" /></>}
        {item.type === 'wardrobe' && <><line x1="0" y1={-d / 2} x2="0" y2={d / 2} stroke="#746d60" strokeWidth="0.02" /><circle cx="-0.06" cy={d / 2 - 0.07} r="0.02" fill="#746d60" /><circle cx="0.06" cy={d / 2 - 0.07} r="0.02" fill="#746d60" /></>}
        <text x="0" y={item.type === 'bed' ? d * 0.15 : d * 0.2} textAnchor="middle" fontSize={Math.min(0.15, w / Math.max(item.name.length, 1) * 1.3)} fill="#42483e" pointerEvents="none">{item.name}</text>
      </g>
    })}
  </>
}
