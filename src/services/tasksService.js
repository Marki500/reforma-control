import { supabase } from './supabaseClient'

export async function getTasks() {
  const { data, error } = await supabase.from('tasks').select('*, rooms(name), task_items(id, title, is_completed, position)').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).order('position', { referencedTable: 'task_items', ascending: true })
  if (error) throw error
  return data || []
}

async function getTask(id) {
  const { data, error } = await supabase.from('tasks').select('*, rooms(name), task_items(id, title, is_completed, position)').eq('id', id).order('position', { referencedTable: 'task_items', ascending: true }).single()
  if (error) throw error
  return data
}

async function syncTaskItems(taskId, items = []) {
  const cleanItems = items.map((item, position) => ({
    id: item.id || null,
    task_id: taskId,
    title: item.title.trim(),
    is_completed: Boolean(item.is_completed),
    position,
  })).filter(item => item.title)
  const keptIds = cleanItems.filter(item => item.id).map(item => item.id)
  let deleteQuery = supabase.from('task_items').delete().eq('task_id', taskId)
  if (keptIds.length) deleteQuery = deleteQuery.not('id', 'in', `(${keptIds.join(',')})`)
  const { error: deleteError } = await deleteQuery
  if (deleteError) throw deleteError

  const existing = cleanItems.filter(item => item.id)
  const added = cleanItems.filter(item => !item.id).map(({ id: _id, ...item }) => item)
  if (existing.length) {
    const { error } = await supabase.from('task_items').upsert(existing)
    if (error) throw error
  }
  if (added.length) {
    const { error } = await supabase.from('task_items').insert(added)
    if (error) throw error
  }
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
  const { data, error } = await query.select('id').single()
  if (error) throw error
  const taskItems = form.status === 'Completada'
    ? form.task_items?.map(item => ({ ...item, is_completed: true }))
    : form.task_items
  await syncTaskItems(data.id, taskItems)
  return getTask(data.id)
}

export async function setTaskCompleted(task, completed) {
  const status = completed ? 'Completada' : 'Pendiente'
  const { error } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id)
  if (error) throw error
  if (completed && task.task_items?.length) {
    const { error: itemError } = await supabase.from('task_items').update({ is_completed: true }).eq('task_id', task.id)
    if (itemError) throw itemError
  }
  return getTask(task.id)
}

export async function setTaskItemCompleted(task, item, completed) {
  const { error } = await supabase.from('task_items').update({ is_completed: completed }).eq('id', item.id).eq('task_id', task.id)
  if (error) throw error
  if (!completed && task.status === 'Completada') {
    const { error: taskError } = await supabase.from('tasks').update({ status: 'En curso', updated_at: new Date().toISOString() }).eq('id', task.id)
    if (taskError) throw taskError
  }
  return getTask(task.id)
}

export async function deleteTask(id) {
  const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data
}
