import { supabase } from './supabaseClient'
import { getCurrentProjectId } from './workspaceService'

export async function getSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('*').eq('project_id', await getCurrentProjectId()).order('status').order('name')
  if (error) throw error
  return data || []
}

export async function saveSupplier(id, form) {
  const payload = {
    name: form.name.trim(), trade: form.trade.trim(), contact_person: form.contact_person.trim(),
    phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(),
    address: form.address.trim(), status: form.status, contacted: Boolean(form.contacted),
    tax_id: (form.tax_id || '').trim(),
    opinion: form.opinion.trim(), notes: form.notes.trim(), updated_at: new Date().toISOString(),
  }
  let query
  if (id) query = supabase.from('suppliers').update(payload).eq('id', id)
  else {
    query = supabase.from('suppliers').insert({ ...payload, project_id: await getCurrentProjectId() })
  }
  const { data, error } = await query.select().single()
  if (error?.code === '23505') throw new Error('Ya existe un proveedor con ese NIF/CIF en esta reforma. Revisa su ficha antes de crear otro.')
  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { data, error } = await supabase.from('suppliers').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
