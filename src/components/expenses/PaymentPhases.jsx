import { formatCurrency } from '../../utils/formatCurrency'
import { createPaymentPhases, paymentProgress, phasePaid, phasesOf, paymentToday, toCents } from '../../utils/paymentPhases'

const input = 'mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm'
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') : ''

export function PaymentProgress({ expense }) {
  const phases = phasesOf(expense), progress = paymentProgress(expense)
  return <div className="mt-4 space-y-2" aria-label={`Progreso de pago de ${expense.title}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-stone-700">{phases.length ? `${progress.completed} de ${phases.length} fases pagadas` : 'Progreso del pago'}</span><span className="font-semibold tabular-nums text-olive">{progress.percent}% pagado</span></div>
    <div role="progressbar" aria-label={`Importe pagado de ${expense.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-olive transition-[width]" style={{ width: `${progress.percent}%` }} /></div>
    {phases.length > 0 && <>
      <p className="text-xs font-medium text-stone-700">{progress.next ? `Fase pendiente ${progress.nextIndex + 1}: ${progress.next.title}` : 'Todas las fases pagadas'}</p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">{phases.map((phase, index) => <li key={phase.id} className={`rounded-lg border p-2 text-xs ${phase.paid ? 'border-olive/20 bg-olive-light text-stone-700' : index === progress.nextIndex ? 'border-olive bg-white text-stone-800' : 'border-stone-200 text-stone-500'}`}><span className="block break-words font-semibold">{index + 1}. {phase.title}</span><span className="mt-1 block tabular-nums">{formatCurrency(phase.amount)} · {phase.paid ? 'Pagada' : 'Pendiente'}</span><span className="mt-1 block">{phase.paid ? phase.paid_date ? `Pagada el ${date(phase.paid_date)}` : 'Fecha de pago no informada' : phase.due_date ? `Vence ${date(phase.due_date)}` : 'Sin vencimiento'}</span></li>)}</ol>
    </>}
  </div>
}

export function PaymentPhasesEditor({ form, onChange }) {
  const phases = phasesOf(form)
  function setPhases(next) { onChange('payment_phases', next) }
  function update(id, patch) { setPhases(phases.map(phase => phase.id === id ? { ...phase, ...patch } : phase)) }
  const difference = toCents(form.amount) - phases.reduce((sum, phase) => sum + toCents(phase.amount), 0)
  return <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4" aria-label="Plan de pagos por fases">
    <div><h3 className="text-sm font-semibold text-stone-800">Pagos por fases</h3><p className="mt-1 text-xs leading-relaxed text-stone-600">Organiza anticipos, pagos de obra y liquidación. Marca una fase como pagada cuando hayas realizado ese pago y guarda el gasto.</p></div>
    {!phases.length ? <button type="button" disabled={toCents(form.amount) <= 0 || toCents(form.paid_amount) > toCents(form.amount)} onClick={() => setPhases(createPaymentPhases(form))} className="min-h-11 rounded-xl bg-olive px-3 text-sm font-medium text-white disabled:opacity-40">Dividir el gasto en fases</button> : <>
      <p className="text-xs text-stone-600">Pagado según las fases: <strong>{formatCurrency(phasePaid(phases))}</strong>. El vencimiento del gasto será el próximo vencimiento pendiente.</p>
      {phases.map((phase, index) => <fieldset key={phase.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"><legend className="px-1 text-xs font-semibold text-stone-700">Fase {index + 1}</legend>
        <label className="block text-sm">Nombre de la fase {index + 1}<input className={input} required maxLength={120} value={phase.title} onChange={event => update(phase.id, { title: event.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Importe fase {index + 1} (€)<input className={input} type="number" min="0.01" step="0.01" required value={phase.amount} onChange={event => update(phase.id, { amount: event.target.value })} /></label><label className="block text-sm">Vencimiento fase {index + 1}<input className={input} type="date" value={phase.due_date || ''} onChange={event => update(phase.id, { due_date: event.target.value || null })} /></label></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={phase.paid} onChange={event => update(phase.id, { paid: event.target.checked, paid_date: event.target.checked ? paymentToday() : null })} className="h-4 w-4 accent-olive" />Fase {index + 1} pagada</label>
        {phase.paid && <label className="block text-sm">Fecha de pago fase {index + 1}<input aria-label={`Fecha de pago fase ${index + 1}`} type="date" max={paymentToday()} value={phase.paid_date || ''} onChange={event => update(phase.id, { paid_date: event.target.value || null })} className={input} /><span className="mt-1 block text-xs text-stone-500">Si desconoces la fecha de un pago anterior, déjala vacía.</span></label>}
        <div className="flex flex-wrap gap-3 text-xs"><button type="button" disabled={index === 0} onClick={() => { const next = [...phases]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setPhases(next) }} className="min-h-9 text-olive underline disabled:opacity-30">Subir fase {index + 1}</button><button type="button" onClick={() => setPhases(phases.filter(item => item.id !== phase.id))} className="min-h-9 text-red-700 underline">Eliminar fase {index + 1}</button></div>
      </fieldset>)}
      <p role="status" className={`text-sm ${difference ? 'text-amber-800' : 'text-olive'}`}>{difference ? difference > 0 ? `Falta distribuir ${formatCurrency(difference)} para coincidir con el coste final.` : `Las fases superan el coste final en ${formatCurrency(-difference)}.` : 'La suma de las fases coincide con el coste final.'}</p>
      <button type="button" disabled={phases.length >= 50} onClick={() => setPhases([...phases, { id: crypto.randomUUID(), title: '', amount: '', due_date: null, paid: false, paid_date: null }])} className="min-h-11 text-sm font-medium text-olive underline">Añadir fase</button>
    </>}
  </section>
}
