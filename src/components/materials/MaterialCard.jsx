import { Package, ExternalLink, Edit3, Trash2, Heart, DollarSign, Copy } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatCurrency } from '../../utils/formatCurrency'
import { extractDomain } from '../../utils/extractDomain'

export default function MaterialCard({ material, onEdit, onDelete, onToggleCount, onDuplicate }) {
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
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
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
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold leading-snug text-stone-800 line-clamp-2">{material.name}</h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Count toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleCount?.(material) }}
                className={`rounded-lg p-1.5 transition-all ${
                  material.count_in_total === false
                    ? 'text-stone-300 hover:text-stone-400'
                    : 'text-olive hover:text-olive-dark'
                }`}
                title={material.count_in_total === false ? 'No cuenta en totales' : 'Cuenta en totales'}
              >
                <DollarSign size={14} />
              </button>
              {/* Duplicate */}
              <button
                type="button"
                onClick={() => onDuplicate(material)}
                className="rounded-lg p-1.5 text-stone-300 transition-colors hover:text-stone-500"
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={() => onDelete(material)}
                className="rounded-lg p-1.5 text-stone-300 transition-colors hover:text-red-400"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {(material.brand || material.model) && (
            <p className="truncate text-xs text-stone-400">
              {[material.brand, material.model].filter(Boolean).join(' · ')}
            </p>
          )}

          {(material.material_categories?.name || material.rooms?.name) && (
            <p className="truncate text-xs text-stone-400">
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
            <span className="text-xl font-bold text-stone-800 tracking-tight">
              {material.price ? formatCurrency(material.price) : '—'}
            </span>
            {material.quantity > 1 && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                x{material.quantity}
              </span>
            )}
          </div>
          {material.price && material.quantity > 1 && (
            <span className="text-xs text-stone-400">
              {formatCurrency(material.price * material.quantity)}
            </span>
          )}
        </div>

        {/* Store */}
        {material.store_name && (
          <p className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="font-medium text-stone-500">{material.store_name}</span>
            {material.product_url && (
              <>
                <span className="text-stone-200">·</span>
                <span className="text-stone-400">{extractDomain(material.product_url)}</span>
              </>
            )}
          </p>
        )}

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
