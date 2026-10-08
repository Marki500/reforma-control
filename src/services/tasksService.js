import { supabase } from './supabaseClient'

export async function getTasks() {
  const { data, error } = await supabase.from('tasks').select('*, rooms(name)').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveTask(id, form) {
  const payload = {
    title: form.title.trim(), description: form.description.trim(),
    status: form.status, priority: form.priority,
    due_date: form.due_date || null, room_id: form.room_id || null,
    updated_at: new Date().toISOString(),
  }
  let query
  if (id) {
    query = supabase.from('tasks').update(payload).eq('id', id)
  } else {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data.user) throw new Error('Inicia sesión de nuevo.')
    query = supabase.from('tasks').insert({ ...payload, user_id: data.user.id })
  }
  const { data, error } = await query.select('*, rooms(name)').single()
  if (error) throw error
  return data
}

export async function deleteTask(id) {
  const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
