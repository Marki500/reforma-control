import { Filter, X } from 'lucide-react'

const statuses = ['Mirando', 'Favorito', 'Pendiente de decidir', 'Descartado', 'Comprado', 'Recibido', 'Devuelto']
const priorities = ['Baja', 'Media', 'Alta', 'Urgente']

export default function MaterialsFilters({
  categories,
  rooms,
  filters,
  onChange,
  onClear,
}) {
  function update(key, value) {
    onChange({ ...filters, [key]: value || '' })
  }

  const hasFilters = filters.category_id || filters.room_id || filters.status || filters.priority

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-stone-400" />
        <span className="text-sm font-medium text-stone-700">Filtros</span>
        {hasFilters && (
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
          >
            <X size={14} />
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </div>
  )
}
