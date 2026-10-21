export const toCents = value => Math.round((Number(value) || 0) * 100)
export const paymentToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
export const phasesOf = expense => Array.isArray(expense.payment_phases) ? expense.payment_phases : []
export const phasePaid = phases => phases.reduce((sum, phase) => sum + (phase.paid ? toCents(phase.amount) : 0), 0) / 100
export const phaseDue = phases => phases.filter(phase => !phase.paid && phase.due_date).map(phase => phase.due_date).sort()[0] || ''

export function createPaymentPhases(expense) {
  const total = toCents(expense.amount), paid = toCents(expense.paid_amount)
  const phase = (title, amount, done = false, due = null) => ({ id: crypto.randomUUID(), title, amount: amount / 100, paid: done, paid_date: null, due_date: due })
  if (total <= 0 || paid > total) return []
  if (paid > 0) return [phase('Pagos anteriores', paid, true), ...(total > paid ? [phase('Pago pendiente', total - paid, false, expense.due_date || null)] : [])]
  if (total < 3) return [phase('Pago final', total, false, expense.due_date || null)]
  const first = Math.round(total * 0.3), second = Math.round(total * 0.4)
  return [phase('Anticipo', first), phase('Durante la obra', second), phase('Liquidación', total - first - second, false, expense.due_date || null)]
}

export function validatePaymentPhases(phases, amount) {
  if (!phases.length) return ''
  if (phases.length > 50) return 'Puedes definir hasta 50 fases por gasto.'
  if (phases.some(phase => !phase.title.trim() || !Number.isFinite(Number(phase.amount)) || toCents(phase.amount) <= 0)) return 'Cada fase necesita un nombre y un importe mayor que cero.'
  if (phases.reduce((sum, phase) => sum + toCents(phase.amount), 0) !== toCents(amount)) return 'La suma de las fases debe coincidir con el coste final del gasto.'
  if (phases.some(phase => phase.paid && phase.paid_date && phase.paid_date > paymentToday())) return 'La fecha de un pago realizado no puede estar en el futuro.'
  return ''
}

export function paymentProgress(expense) {
  const phases = phasesOf(expense), total = toCents(expense.amount), paid = toCents(expense.paid_amount)
  const nextIndex = phases.findIndex(phase => !phase.paid)
  return { percent: total > 0 ? Math.min(100, Math.max(0, Math.round(paid / total * 100))) : 0, completed: phases.filter(phase => phase.paid).length, next: nextIndex < 0 ? null : phases[nextIndex], nextIndex }
}

export function pendingPayments(expense) {
  const phases = phasesOf(expense)
  if (phases.length) return phases.filter(phase => !phase.paid && phase.due_date).map(phase => ({ id: phase.id, date: phase.due_date, title: `${expense.title} · ${phase.title}`, amount: Number(phase.amount) }))
  const amount = Math.max((Number(expense.amount) || 0) - (Number(expense.paid_amount) || 0), 0)
  return expense.due_date && amount > 0 ? [{ id: '', date: expense.due_date, title: expense.title, amount }] : []
}
