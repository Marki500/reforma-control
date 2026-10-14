import { useState } from 'react'
import { ChevronDown, Filter, X } from 'lucide-react'

const statuses = ['Mirando', 'Favorito', 'Pendiente de decidir', 'Descartado', 'Comprado', 'Recibido', 'Devuelto']
const priorities = ['Baja', 'Media', 'Alta', 'Urgente']

export default function MaterialsFilters({
  categories,
  rooms,
  filters,
  onChange,
  onClear,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  function update(key, value) {
    onChange({ ...filters, [key]: value || '' })
  }

  const hasFilters = filters.category_id || filters.room_id || filters.status || filters.priority

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex min-h-[2.75rem] items-center gap-2 sm:min-h-0 sm:mb-3">
        <Filter size={16} className="text-stone-400" />
        <button type="button" onClick={() => setMobileOpen(value => !value)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-stone-700 sm:pointer-events-none">
          Filtros
          {hasFilters && <span className="rounded-full bg-terracotta px-2 py-0.5 text-[10px] text-white sm:hidden">Activos</span>}
          <ChevronDown size={16} className={`ml-auto transition-transform sm:hidden ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        {hasFilters && (
          <button
            onClick={onClear}
            className="hidden items-center gap-1 text-xs text-stone-500 hover:text-stone-700 sm:ml-auto sm:inline-flex"
          >
            <X size={14} />
            Limpiar filtros
          </button>
        )}
      </div>

      <div className={`${mobileOpen ? 'grid' : 'hidden'} mt-3 grid-cols-1 gap-3 sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-4`}>
        <select
          value={filters.category_id || ''}
          onChange={(e) => update('category_id', e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={filters.room_id || ''}
          onChange={(e) => update('room_id', e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        >
          <option value="">Todas las estancias</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>

        <select
          value={filters.status || ''}
          onChange={(e) => update('status', e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.priority || ''}
          onChange={(e) => update('priority', e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        >
          <option value="">Todas las prioridades</option>
          {priorities.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {hasFilters && <button type="button" onClick={onClear} className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-stone-100 text-sm text-stone-600 sm:hidden"><X size={15} /> Limpiar filtros</button>}
      </div>
    </div>
  )
}
