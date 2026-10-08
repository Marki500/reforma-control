import { supabase } from './supabaseClient'

function payloadFrom(form) {
  return {
    title: form.title.trim(), category: form.category, vendor: form.vendor.trim(),
    budgeted_amount: Number(form.budgeted_amount) || 0,
    amount: Number(form.amount) || 0, paid_amount: Number(form.paid_amount) || 0,
    expense_date: form.expense_date || null, due_date: form.due_date || null,
    room_id: form.room_id || null, notes: form.notes.trim(), updated_at: new Date().toISOString(),
  }
}

export async function getExpenses() {
  const { data, error } = await supabase.from('expenses').select('*, rooms(name)').order('expense_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveExpense(id, form) {
  const payload = payloadFrom(form)
  let query
  if (id) query = supabase.from('expenses').update(payload).eq('id', id)
  else {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data.user) throw new Error('Inicia sesión de nuevo.')
    query = supabase.from('expenses').insert({ ...payload, user_id: data.user.id })
  }
  const { data, error } = await query.select('*, rooms(name)').single()
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
