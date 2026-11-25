import { useMemo } from 'react'
import { expensePayerBreakdown } from '../../utils/expensePayers.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 })

export default function ExpensesByPerson({ expenses, members, loading, selectedPayer = '', onSelectPayer }) {
  const people = useMemo(() => expensePayerBreakdown(expenses, members), [expenses, members])
  const maximum = Math.max(0, ...people.map(person => person.paid + person.pending))
  return (
    <section aria-label="Gastos por persona" className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-800">Aportaciones por persona</h2>
          <p className="mt-1 text-xs text-stone-500">Pulsa una persona para ver sus gastos y pagos pendientes.</p>
        </div>
        <div className="flex gap-4 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-olive" />Pagado</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-gold" />Pendiente</span>
        </div>
      </div>
      {loading ? <p role="status" className="mt-5 text-sm text-stone-500">Cargando aportaciones…</p>
        : !expenses.length ? <p className="mt-5 text-sm text-stone-500">Al añadir gastos y asignar quién paga, verás aquí las aportaciones.</p>
          : <ul className="mt-5 space-y-5">{people.map(person => (
            <li key={person.id}>
              <button
                type="button"
                aria-label={`Filtrar gastos: ${person.label}`}
                aria-pressed={selectedPayer === (person.id || 'unassigned')}
                onClick={() => onSelectPayer?.(selectedPayer === (person.id || 'unassigned') ? '' : person.id || 'unassigned')}
                className={`w-full rounded-xl p-3 text-left ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${selectedPayer === (person.id || 'unassigned') ? 'bg-olive-light ring-olive' : 'ring-transparent hover:bg-stone-50 hover:ring-stone-200'}`}
              >
              <span className="mb-2 flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-sm font-medium text-stone-800">{person.label}</span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-stone-800">{formatCurrency(person.paid)} <span className="font-normal text-stone-500">pagado</span></span>
                  <span className="mt-0.5 block text-xs text-stone-500">{percent.format(person.paidShare)} del total pagado</span>
                </span>
              </span>
              <span role="img" aria-label={`${person.label}: ${formatCurrency(person.paid)} pagado y ${formatCurrency(person.pending)} pendiente`} className="flex h-3 overflow-hidden rounded-full bg-stone-100">
                <span aria-hidden="true" className="h-full bg-olive" style={{ width: `${maximum ? person.paid / maximum * 100 : 0}%` }} />
                <span aria-hidden="true" className="h-full bg-gold" style={{ width: `${maximum ? person.pending / maximum * 100 : 0}%` }} />
              </span>
              <span className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs tabular-nums text-stone-500">
                <span>Asignado {formatCurrency(person.committed)}</span>
                <span>Pendiente {formatCurrency(person.pending)}</span>
              </span>
              </button>
            </li>
          ))}</ul>}
      {!loading && expenses.length > 0 && <p className="mt-5 border-t border-stone-100 pt-3 text-xs text-stone-500">Resumen de todos los gastos, según la persona asignada a cada uno.</p>}
    </section>
  )
}
