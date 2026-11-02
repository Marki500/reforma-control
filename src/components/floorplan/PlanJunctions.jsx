import { useEffect, useRef, useState } from 'react'

export default function PlanJunctions({ junctions, selected, view, interactive, onSelect }) {
  const group = useRef(null)
  const [scale, setScale] = useState(50)
  useEffect(() => {
    const update = () => {
      const matrix = group.current?.getScreenCTM()
      if (matrix) setScale(Math.max(0.001, Math.hypot(matrix.a, matrix.b)))
    }
    update()
    const observer = new ResizeObserver(update)
    const svg = group.current?.ownerSVGElement
    if (svg) observer.observe(svg)
    return () => observer.disconnect()
  }, [view])
  return <g ref={group} aria-label="Uniones entre paredes">
    {junctions.map(junction => <g key={junction.id} data-plan-kind="junction" data-plan-id={junction.id}
      transform={`translate(${junction.point.x} ${junction.point.y}) scale(${1 / scale})`}
      pointerEvents={interactive ? 'all' : 'none'} className={interactive ? junction.locked ? 'cursor-not-allowed' : 'cursor-move' : ''}
      onPointerDown={event => onSelect(event, { ...junction, kind: 'junction' })}>
      <title>{junction.wallIds.length} paredes unidas{junction.locked ? ' · Pared bloqueada' : ' · Arrastra para mover la unión'}</title>
      <circle r="14" fill="transparent" />
      <circle r={selected?.kind === 'junction' && selected.id === junction.id ? 7 : 5} fill={junction.locked ? '#e7e5e4' : 'white'} stroke={selected?.id === junction.id ? '#d86d4d' : '#68765d'} strokeWidth="1.8" />
      <circle r="1.5" fill="#68765d" />
    </g>)}
  </g>
}
