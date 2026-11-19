import { Check, LoaderCircle, ShoppingCart } from 'lucide-react'

export default function MaterialPurchaseButton({ material, onPurchase, pending = false, disabled = false }) {
  const completed = ['Comprado', 'Recibido'].includes(material.status)
  const label = pending ? 'Guardando…' : completed ? material.status : 'Marcar comprado'
  const Icon = pending ? LoaderCircle : completed ? Check : ShoppingCart
  return <button
    type="button"
    aria-label={`${label}: ${material.name}`}
    aria-busy={pending}
    disabled={disabled || pending || completed || !onPurchase}
    onClick={() => onPurchase(material)}
    className={`inline-flex min-h-11 whitespace-nowrap items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-2 disabled:cursor-default ${completed ? material.status === 'Recibido' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800' : 'bg-stone-700 text-white hover:bg-stone-800 disabled:opacity-50'}`}
  >
    <Icon size={15} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
    {label}
  </button>
}
