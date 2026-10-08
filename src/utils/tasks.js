export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isTaskOverdue(task, today = localDateKey()) {
  return Boolean(task.due_date && task.due_date < today && task.status !== 'Completada')
}
export function filterTasks(tasks, { search = '', status = '', priority = '', room_id = '', overdue = false }, today = localDateKey()) {
  const query = search.trim().toLocaleLowerCase('es')
  return tasks.filter(task => (!status || task.status === status)
    && (!priority || task.priority === priority)
    && (!room_id || task.room_id === room_id)
    && (!overdue || isTaskOverdue(task, today))
    && (!query || `${task.title} ${task.description}`.toLocaleLowerCase('es').includes(query)))
}
