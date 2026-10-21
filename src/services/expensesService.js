import { supabase } from './supabaseClient'
import { getCurrentProjectId } from './workspaceService'
import { phasesOf, phasePaid, phaseDue } from '../utils/paymentPhases'

function payloadFrom(form) {
  return {
    title: form.title.trim(), category: form.category, vendor: form.vendor.trim(),
    budgeted_amount: Number(form.budgeted_amount) || 0,
    amount: Number(form.amount) || 0, paid_amount: Number(form.paid_amount) || 0,
    expense_date: form.expense_date || null, due_date: form.due_date || null,
    room_id: form.room_id || null, supplier_id: form.supplier_id || null,
    notes: form.notes.trim(), updated_at: new Date().toISOString(),
    payment_phases: phasesOf(form).map(phase => ({ ...phase, title: phase.title.trim(), amount: Number(phase.amount) })),
    payment_plan_version: form.payment_plan_version ?? 0,
  }
}

export async function getExpenses() {
  const { data, error } = await supabase.from('expenses').select('*, rooms(name), suppliers(name), invoices(id, invoice_number)').order('expense_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveExpense(id, form) {
  const payload = payloadFrom(form)
  if (payload.payment_phases.length) {
    payload.paid_amount = phasePaid(payload.payment_phases)
    payload.due_date = phaseDue(payload.payment_phases) || null
  }
  let query
  if (id) query = supabase.from('expenses').update(payload).eq('id', id)
  else {
    query = supabase.from('expenses').insert({ ...payload, project_id: await getCurrentProjectId() })
  }
  const { data, error } = await query.select('*, rooms(name), suppliers(name), invoices(id, invoice_number)').single()
  if (error?.code === '40001') {
    const conflict = new Error('Los pagos han cambiado. Cierra y vuelve a abrir el gasto para revisar los datos actualizados.')
    conflict.code = '40001'; throw conflict
  }
  if (['PGRST204', '42703'].includes(error?.code)) throw new Error('Comprueba que se ha aplicado la migración 00032 de pagos por fases antes de guardar.')
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
