import { supabase } from './supabaseClient'

export async function getSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('*').order('status').order('name')
  if (error) throw error
  return data || []
}

export async function saveSupplier(id, form) {
  const payload = {
    name: form.name.trim(), trade: form.trade, contact_person: form.contact_person.trim(),
    phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(),
    address: form.address.trim(), status: form.status, notes: form.notes.trim(), updated_at: new Date().toISOString(),
  }
  let query
  if (id) query = supabase.from('suppliers').update(payload).eq('id', id)
  else {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data.user) throw new Error('Inicia sesión de nuevo.')
    query = supabase.from('suppliers').insert({ ...payload, user_id: data.user.id })
  }
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { data, error } = await supabase.from('suppliers').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
