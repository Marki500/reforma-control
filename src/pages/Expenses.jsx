import { useEffect, useMemo, useState } from 'react'
import { PaymentProgress, PaymentPhasesEditor } from '../components/expenses/PaymentPhases'
import { phasesOf, phasePaid, phaseDue, validatePaymentPhases } from '../utils/paymentPhases'
import { Link, useSearchParams } from 'react-router-dom'
import { expenseInvoice } from '../utils/invoices'
import { Plus, Pencil, Trash2, Receipt, WalletCards } from 'lucide-react'
import { getRooms } from '../services/materialsService'
import { deleteExpense, getExpenses, saveExpense } from '../services/expensesService'
import { getSuppliers } from '../services/suppliersService'
import { expenseStatus, expenseTotals, filterExpenses } from '../utils/expenses'
import { formatCurrency } from '../utils/formatCurrency'
import { recordedExpensesSummary } from '../utils/dashboardFinance'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

import { getWorkspaceMembers } from '../services/workspaceService'

const categories = ['Material', 'Mano de obra', 'Transporte', 'Licencia', 'Otro']
const statuses = ['Pendiente', 'Parcial', 'Pagado']
const empty = { payer_user_id: '', payment_phases: [], payment_plan_version: 0, title: '', category: 'Material', vendor: '', supplier_id: '', budgeted_amount: '', amount: '', paid_amount: '', expense_date: '', due_date: '', room_id: '', notes: '' }
const fieldClass = 'mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm'

export default function Expenses() {
  const [searchParams] = useSearchParams()
  const [expenses, setExpenses] = useState([])
  const [members, setMembers] = useState([])
  const [rooms, setRooms] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', category: '', room_id: '', payer_user_id: '' })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [items, roomList, supplierList, memberList] = await Promise.all([getExpenses(), getRooms(), getSuppliers(), getWorkspaceMembers()])
      setMembers(memberList); setExpenses(items); setRooms(roomList); setSuppliers(supplierList.filter(item => item.status !== 'Archivado'))
    } catch (err) { setError(err.message || 'No se pudieron cargar los gastos.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => expenseTotals(expenses), [expenses])
  const filtered = filterExpenses(expenses, filters).filter(item => !searchParams.get('expense') || item.id === searchParams.get('expense'))
  const editingInvoice = expenseInvoice(expenses.find(item => item.id === editing) || {})
  const pending = recordedExpensesSummary(expenses).pending
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value, ...(key === 'payment_phases' && value.length ? { paid_amount: String(phasePaid(value)), due_date: phaseDue(value) } : {}) }))

  function edit(expense) {
    setEditing(expense?.id || null)
    setForm(expense ? {
      ...empty, ...expense,
      budgeted_amount: String(expense.budgeted_amount ?? ''), amount: String(expense.amount ?? ''), paid_amount: String(expense.paid_amount ?? ''),
      payer_user_id: expense.payer_user_id || '', expense_date: expense.expense_date || '', due_date: expense.due_date || '', room_id: expense.room_id || '', supplier_id: expense.supplier_id || '',
    } : { ...empty })
    setFormError(''); setOpen(true)
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const amount = Number(form.amount) || 0
    const paid = phasesOf(form).length ? phasePaid(form.payment_phases) : Number(form.paid_amount) || 0
    const phaseError = validatePaymentPhases(phasesOf(form), amount)
    if (phaseError) { setFormError(phaseError); return }
    if (!form.title.trim()) { setFormError('Escribe un concepto.'); return }
    if (amount < 0 || paid < 0 || Number(form.budgeted_amount || 0) < 0) { setFormError('Los importes no pueden ser negativos.'); return }
    if (paid > amount) { setFormError('La cantidad pagada no puede superar el coste final.'); return }
    setBusy(true); setFormError('')
    try {
      const saved = await saveExpense(editing, form)
      setExpenses(previous => editing ? previous.map(item => item.id === saved.id ? saved : item) : [saved, ...previous])
      setOpen(false)
    } catch (err) { if (err.code === '40001') await load(); setFormError(err.message || 'No se pudo guardar el gasto.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (busy || !deleting) return
    setBusy(true); setError('')
    try { await deleteExpense(deleting.id); setExpenses(previous => previous.filter(item => item.id !== deleting.id)); setDeleting(null) }
    catch (err) { setError(err.message || 'No se pudo eliminar el gasto.'); setDeleting(null) }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-stone-800">Gastos y pagos</h1><p className="mt-1 text-sm text-stone-500">Controla lo previsto, quién paga cada gasto y los pagos registrados.</p></div>
        <Button className="w-full sm:w-auto" onClick={() => edit(null)} disabled={loading || Boolean(error)}><Plus size={16} /> Añadir gasto</Button>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button onClick={load} className="underline">Reintentar</button></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Previsto', totals.budgeted], ['Gastos registrados', totals.actual], ['Pagado', totals.paid], ['Pendiente', pending],
        ].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-stone-800">{formatCurrency(value)}</p></div>)}
      </div>

      <section aria-label="Gastos por persona" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-stone-800">Quién paga qué</h2>
        <p className="mt-1 text-xs text-stone-500">Cada gasto se atribuye a una persona, incluidos sus pagos registrados.</p>
        <div className="mt-3 space-y-2">{[...members.map(member => ({ id: member.user_id, label: member.email })), { id: '', label: 'Sin asignar' }, ...[...new Set(expenses.map(item => item.payer_user_id).filter(id => id && !members.some(member => member.user_id === id)))].map(id => ({ id, label: 'Antiguo miembro' }))].map(person => {
          const items = expenses.filter(item => (item.payer_user_id || '') === person.id)
          const total = recordedExpensesSummary(items)
          return <div key={person.id} className="flex flex-wrap justify-between gap-2 border-t border-stone-100 pt-2 text-sm"><span className="break-all font-medium">{person.label}</span><span className="text-stone-600">Asignado {formatCurrency(total.committed)} · Pagado {formatCurrency(total.paid)} · Pendiente {formatCurrency(total.pending)}</span></div>
        })}</div>
      </section>

      {searchParams.get('expense') && <Link to="/gastos" className="inline-block text-sm text-olive underline">Ver todos los gastos</Link>}
      <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Filtrar por quién paga" className={fieldClass} value={filters.payer_user_id} onChange={event => setFilters(prev => ({ ...prev, payer_user_id: event.target.value }))}><option value="">Todas las personas</option><option value="unassigned">Sin asignar</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.email}</option>)}</select>
        <input aria-label="Buscar gastos" placeholder="Buscar concepto o proveedor…" className={fieldClass} value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
        <select aria-label="Filtrar por estado" className={fieldClass} value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}><option value="">Todos los estados</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por categoría" className={fieldClass} value={filters.category} onChange={event => setFilters(prev => ({ ...prev, category: event.target.value }))}><option value="">Todas las categorías</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filtrar por estancia" className={fieldClass} value={filters.room_id} onChange={event => setFilters(prev => ({ ...prev, room_id: event.target.value }))}><option value="">Todas las estancias</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
      </div>

      {loading ? <p role="status">Cargando gastos…</p> : !error && filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-stone-500"><Receipt className="mx-auto mb-3" />{expenses.length ? 'No hay gastos con estos filtros.' : 'Añade el primer gasto de la reforma.'}</div>
      ) : <div className="space-y-3">{filtered.map(expense => {
        const status = expenseStatus(expense)
        const amount = Number(expense.amount) || 0
        const paid = Number(expense.paid_amount) || 0
        return <article key={expense.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-stone-100 p-2 text-stone-600"><WalletCards size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold text-stone-800">{expense.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status === 'Pagado' ? 'bg-green-100 text-green-700' : status === 'Parcial' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>{status}</span></div>
              <p className="mt-1 text-lg font-bold text-stone-800">{formatCurrency(amount)} <span className="text-xs font-normal text-stone-500">· pagado {formatCurrency(paid)}</span></p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500"><span>{expense.category}</span>{(expense.suppliers?.name || expense.vendor) && <span>{expense.suppliers?.name || expense.vendor}</span>}{expense.rooms?.name && <span>{expense.rooms.name}</span>}{expense.expense_date && <span>{new Date(`${expense.expense_date}T12:00:00`).toLocaleDateString('es-ES')}</span>}{expense.due_date && status !== 'Pagado' && <span>Vence {new Date(`${expense.due_date}T12:00:00`).toLocaleDateString('es-ES')}</span>}</div>
              <p className="mt-2 break-all text-xs font-medium text-stone-600">Quién paga: {expense.payer_user_id ? members.find(member => member.user_id === expense.payer_user_id)?.email || 'Antiguo miembro' : 'Sin asignar'}</p>
              <PaymentProgress expense={expense} />
              <button type="button" disabled={busy} onClick={() => edit(expense)} className="mt-2 min-h-11 text-sm font-medium text-olive underline">Gestionar pagos</button>
              {expenseInvoice(expense) && <Link to={`/facturas?invoice=${expenseInvoice(expense).id}`} className="mt-3 inline-block text-sm font-medium text-olive underline">Ver factura {expenseInvoice(expense).invoice_number}</Link>}
              {expense.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-500">{expense.notes}</p>}
            </div>
            <button aria-label={`Editar ${expense.title}`} className="rounded-lg p-2 text-stone-500" disabled={busy} onClick={() => edit(expense)}><Pencil size={18} /></button>
            <button aria-label={`Eliminar ${expense.title}`} className="rounded-lg p-2 text-stone-500" disabled={busy || Boolean(expenseInvoice(expense))} title={expenseInvoice(expense) ? 'Retira la factura vinculada antes de eliminar el gasto' : undefined} onClick={() => setDeleting(expense)}><Trash2 size={18} /></button>
          </div>
        </article>
      })}</div>}

      <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? 'Editar gasto' : 'Nuevo gasto'}>
        <form onSubmit={submit} className="space-y-4">
          {editingInvoice && <p className="rounded-xl bg-olive-light p-3 text-sm text-stone-700">Vinculado a la factura {editingInvoice.invoice_number}. Puedes registrar pagos; para corregir el importe, retira primero la factura.</p>}
          {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <label className="block text-sm">Concepto<input className={fieldClass} value={form.title} required maxLength={200} onChange={event => change('title', event.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Quién paga<select className={fieldClass} value={form.payer_user_id} onChange={event => change('payer_user_id', event.target.value)}><option value="">Sin asignar</option>{form.payer_user_id && !members.some(member => member.user_id === form.payer_user_id) && <option value={form.payer_user_id}>Antiguo miembro</option>}{members.map(member => <option key={member.user_id} value={member.user_id}>{member.email}</option>)}</select></label>
            <label className="block text-sm">Categoría<select className={fieldClass} value={form.category} onChange={event => change('category', event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="block text-sm">Proveedor guardado<select className={fieldClass} value={form.supplier_id} onChange={event => { const id = event.target.value; const supplier = suppliers.find(item => item.id === id); setForm(previous => ({ ...previous, supplier_id: id, vendor: supplier?.name || previous.vendor })) }}><option value="">Sin proveedor asociado</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className="block text-sm">Nombre en factura<input className={fieldClass} value={form.vendor} maxLength={200} onChange={event => change('vendor', event.target.value)} /></label>
            <label className="block text-sm">Importe previsto<input type="number" min="0" step="0.01" className={fieldClass} value={form.budgeted_amount} onChange={event => change('budgeted_amount', event.target.value)} /></label>
            <label className="block text-sm">Coste final<input type="number" min="0" step="0.01" className={fieldClass} disabled={Boolean(editingInvoice)} value={form.amount} onChange={event => change('amount', event.target.value)} /></label>
            <label className="block text-sm">Cantidad pagada<input type="number" min="0" step="0.01" className={fieldClass} disabled={phasesOf(form).length > 0} value={form.paid_amount} onChange={event => change('paid_amount', event.target.value)} /></label>
            <label className="block text-sm">Estancia<select className={fieldClass} value={form.room_id} onChange={event => change('room_id', event.target.value)}><option value="">Sin estancia</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
            <label className="block text-sm">Fecha del gasto<input type="date" className={fieldClass} value={form.expense_date} onChange={event => change('expense_date', event.target.value)} /></label>
            <label className="block text-sm">Fecha límite de pago<input type="date" className={fieldClass} disabled={phasesOf(form).length > 0} value={form.due_date} onChange={event => change('due_date', event.target.value)} /></label>
          </div>
          <PaymentPhasesEditor form={form} onChange={change} />
          <label className="block text-sm">Notas<textarea rows={3} className={fieldClass} value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar gasto'}</Button></div>
        </form>
      </Modal>
      <Modal open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)} title="Eliminar gasto">
        <p className="mb-4 text-sm">¿Eliminar «{deleting?.title}»? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2"><Button disabled={busy} variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button><Button disabled={busy} onClick={remove}>{busy ? 'Eliminando…' : 'Eliminar'}</Button></div>
      </Modal>
    </div>
  )
}
