import MaterialPurchaseButton from './MaterialPurchaseButton'
import { boundedMaterialImageUrl } from '../../utils/materialImages'
import { Package, ExternalLink, Edit3, Trash2, DollarSign, Copy } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatCurrency } from '../../utils/formatCurrency'
import { extractDomain } from '../../utils/extractDomain'

export default function MaterialCard({ material, onEdit, onDelete, onToggleCount, onDuplicate, onPurchase, purchasePending = false, purchaseDisabled = false }) {
  const domain = material.product_url ? extractDomain(material.product_url) : ''
  const store = material.store_name?.trim() || ''
  const sameStore = store.toLowerCase().replace(/^www\./, '') === domain.toLowerCase().replace(/^www\./, '')
  const storeLabel = [store, sameStore ? '' : domain].filter(Boolean).join(' · ')
  return (
    <div className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-colors hover:border-stone-300">
      {/* Image */}
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden border-b border-stone-100 bg-white">
        {material.main_image_url ? (
          <img
            src={boundedMaterialImageUrl(material.main_image_url)}
            loading="lazy"
            decoding="async"
            alt={material.name}
            className="h-full w-full object-contain p-6"
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
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {material.product_url && (
            <a
              href={material.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive hover:bg-white"
            >
              <ExternalLink size={14} className="inline-block mr-1" />
              Producto
            </a>
          )}
          <button
            onClick={() => onEdit(material)}
            className="inline-flex min-h-9 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive hover:bg-white"
          >
            <Edit3 size={14} className="inline-block mr-1" />
            Editar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Name & meta row */}
        <div className="space-y-1">
          <div className="space-y-2">
            <h3 title={material.name} className="min-h-[3.75rem] line-clamp-3 break-words text-sm font-semibold leading-5 text-stone-800">{material.name}</h3>
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
            <p title={material.technical_specs} className="line-clamp-2 text-xs leading-relaxed text-stone-500 whitespace-pre-wrap">
              {material.technical_specs}
            </p>
          </div>
        )}

        <div className="mt-auto space-y-3 pt-2">
          {/* Price row */}
          <div className="flex min-h-8 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
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
          <p title={storeLabel} className="min-h-5 truncate text-xs leading-5 text-stone-500">{storeLabel || 'Sin tienda indicada'}</p>

          <div className="grid gap-2 border-t border-stone-100 pt-3">
            <MaterialPurchaseButton material={material} onPurchase={onPurchase} pending={purchasePending} disabled={purchaseDisabled} />
            <div className="flex items-center gap-1">
              {/* Count toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleCount?.(material) }}
                className={`mr-auto inline-flex min-h-11 whitespace-nowrap items-center gap-1 rounded-lg px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive ${
                  material.count_in_total === false
                    ? 'text-stone-500 hover:text-stone-700'
                    : 'text-olive hover:text-stone-900'
                }`}
                aria-pressed={material.count_in_total !== false}
                title={material.count_in_total === false ? 'No cuenta en totales' : 'Cuenta en totales'}
              >
                <DollarSign size={14} aria-hidden="true" />
                {material.count_in_total === false ? 'Fuera del total' : 'En el total'}
              </button>
              {/* Duplicate */}
              <button
                type="button"
                onClick={() => onDuplicate(material)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors hover:bg-stone-100 hover:text-stone-800"
                aria-label={`Duplicar: ${material.name}`}
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={() => onDelete(material)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors hover:bg-red-50 hover:text-red-700"
                aria-label={`Eliminar: ${material.name}`}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
