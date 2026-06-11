import { supabase } from './supabaseClient'

export async function getNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*, rooms(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createNote({ content, category, room_id }) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userData.user.id, content, category: category || null, room_id: room_id || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(id, { content, category, room_id }) {
  const { data, error } = await supabase
    .from('notes')
    .update({ content, category: category || null, room_id: room_id || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNote(id) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
  if (error) throw error
}
