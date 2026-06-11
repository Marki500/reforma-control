import { Package, ExternalLink, Edit3, Trash2, DollarSign, Copy } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatCurrency } from '../../utils/formatCurrency'

export default function MaterialsTable({ materials, onEdit, onDelete, onToggleCount, onDuplicate }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs font-medium uppercase tracking-wider text-stone-400">
            <th className="w-10 px-2 py-3 text-center">€</th>
            <th className="px-4 py-3">Imagen</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="hidden px-4 py-3 md:table-cell">Categoría</th>
            <th className="hidden px-4 py-3 md:table-cell">Estancia</th>
            <th className="hidden px-4 py-3 md:table-cell">Tienda</th>
            <th className="px-4 py-3">Precio</th>
            <th className="hidden px-4 py-3 md:table-cell">Cant.</th>
            <th className="hidden px-4 py-3 lg:table-cell">Estado</th>
            <th className="hidden px-4 py-3 lg:table-cell">Prioridad</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {materials.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-12 text-center text-stone-400">
                No hay materiales
              </td>
            </tr>
          ) : (
            materials.map((material) => (
              <tr
                key={material.id}
                className={`transition-colors hover:bg-stone-50 ${material.count_in_total === false ? 'opacity-50' : ''}`}
              >
                <td className="px-2 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleCount?.(material)}
                    className={`rounded-lg p-1 transition-all ${
                      material.count_in_total === false
                        ? 'text-stone-300 hover:text-stone-400'
                        : 'text-olive hover:text-olive-dark'
                    }`}
                    title={material.count_in_total === false ? 'No cuenta en totales' : 'Cuenta en totales'}
                  >
                    <DollarSign size={14} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-100">
                    {material.main_image_url ? (
                      <img
                        src={material.main_image_url}
                        alt={material.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package size={16} className="text-stone-300" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="max-w-[160px] px-4 py-3 sm:max-w-none">
                  <p className="truncate font-medium text-stone-800" title={material.name}>{material.name}</p>
                  {(material.brand || material.model) && (
                    <p className="text-xs text-stone-400">
                      {[material.brand, material.model].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {material.technical_specs && (
                    <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">
                      {material.technical_specs}
                    </p>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                  {material.material_categories?.name || '—'}
                </td>
                <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                  {material.rooms?.name || '—'}
                </td>
                <td className="hidden px-4 py-3 text-stone-600 sm:table-cell">
                  {material.store_name || '—'}
                </td>
                <td className="px-4 py-3 font-medium text-stone-800">
                  {material.price ? formatCurrency(material.price) : '—'}
                  {material.quantity > 1 && material.price && (
                    <span className="ml-1 text-xs text-stone-400">
                      ({formatCurrency(material.price * material.quantity)})
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-stone-600 sm:table-cell">
                  {material.quantity || 1}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <Badge>{material.status}</Badge>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  {material.priority && material.priority !== 'Baja' ? (
                    <Badge type="priority">{material.priority}</Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    {material.product_url && (
                      <a
                        href={material.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button
                      onClick={() => onEdit(material)}
                      className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => onDuplicate(material)}
                      className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                      title="Duplicar"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(material)}
                      className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
