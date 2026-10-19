import { Package, ExternalLink, Edit3, Trash2, Heart, DollarSign, Copy } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatCurrency } from '../../utils/formatCurrency'
import { extractDomain } from '../../utils/extractDomain'

export default function MaterialCard({ material, onEdit, onDelete, onToggleCount, onDuplicate }) {
  const domain = material.product_url ? extractDomain(material.product_url) : ''
  const store = material.store_name?.trim() || ''
  const sameStore = store.toLowerCase().replace(/^www\./, '') === domain.toLowerCase().replace(/^www\./, '')
  const storeLabel = [store, sameStore ? '' : domain].filter(Boolean).join(' · ')
  return (
    <div className="group overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-stone-200">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-50">
        {material.main_image_url ? (
          <img
            src={material.main_image_url}
            alt={material.name}
            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : null}
        {!material.main_image_url && (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-full bg-stone-100 p-4">
              <Package size={28} className="text-stone-300" />
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <Badge>{material.status}</Badge>
        </div>

        {/* Priority badge */}
        {material.priority && material.priority !== 'Baja' && (
          <div className="absolute right-3 top-3">
            <Badge type="priority">{material.priority}</Badge>
          </div>
        )}

        {/* Image overlay actions */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/45 to-transparent p-3 opacity-100 transition-all duration-200 sm:inset-0 sm:justify-center sm:bg-black/0 sm:p-0 sm:opacity-0 sm:group-hover:bg-black/30 sm:group-hover:opacity-100 sm:focus-within:bg-black/30 sm:focus-within:opacity-100">
          {material.product_url && (
            <a
              href={material.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              <ExternalLink size={14} className="inline-block mr-1" />
              Producto
            </a>
          )}
          <button
            onClick={() => onEdit(material)}
            className="rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <Edit3 size={14} className="inline-block mr-1" />
            Editar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Name & meta row */}
        <div className="space-y-1">
          <div className="space-y-2">
            <h3 title={material.name} className="break-words text-sm font-semibold leading-relaxed text-stone-800">{material.name}</h3>
            <div className="flex items-center justify-end gap-2">
              {/* Count toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleCount?.(material) }}
                className={`rounded-lg p-2 transition-all ${
                  material.count_in_total === false
                    ? 'text-stone-500 hover:text-stone-700'
                    : 'text-olive hover:text-stone-900'
                }`}
                title={material.count_in_total === false ? 'No cuenta en totales' : 'Cuenta en totales'}
              >
                <DollarSign size={14} />
              </button>
              {/* Duplicate */}
              <button
                type="button"
                onClick={() => onDuplicate(material)}
                className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={() => onDelete(material)}
                className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {(material.brand || material.model) && (
            <p className="truncate text-xs text-stone-600">
              {[material.brand, material.model].filter(Boolean).join(' · ')}
            </p>
          )}

          {(material.material_categories?.name || material.rooms?.name) && (
            <p className="truncate text-xs text-stone-600">
              {[material.material_categories?.name, material.rooms?.name].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Technical specs */}
        {material.technical_specs && (
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <p className="text-xs leading-relaxed text-stone-500 whitespace-pre-wrap">
              {material.technical_specs}
            </p>
          </div>
        )}

        {/* Price row */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-stone-800 tracking-tight">
              {material.price ? formatCurrency(material.price) : '—'}
            </span>
            {material.quantity > 1 && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                x{material.quantity}
              </span>
            )}
          </div>
          {material.price && material.quantity > 1 && (
            <span className="text-xs text-stone-600">
              {formatCurrency(material.price * material.quantity)}
            </span>
          )}
        </div>

        {/* Store */}
        {storeLabel && <p className="break-words text-xs leading-relaxed text-stone-600">{storeLabel}</p>}

        {/* Favorite indicator */}
        {material.status === 'Favorito' && (
          <div className="flex items-center gap-1.5 text-xs text-gold">
            <Heart size={12} className="fill-gold" />
            <span>Favorito</span>
          </div>
        )}
      </div>
    </div>
  )
}
