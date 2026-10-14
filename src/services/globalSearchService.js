import { supabase } from './supabaseClient'

const definitions = [
  { table: 'materials', columns: 'id,name,brand,store_name', field: 'name', type: 'Material', route: '/materials' },
  { table: 'tasks', columns: 'id,title,description', field: 'title', type: 'Tarea', route: '/tareas' },
  { table: 'suppliers', columns: 'id,name,trade', field: 'name', type: 'Proveedor', route: '/proveedores' },
  { table: 'budget_pdfs', columns: 'id,name,status', field: 'name', type: 'Presupuesto', route: '/presupuestos' },
  { table: 'expenses', columns: 'id,title,vendor', field: 'title', type: 'Gasto', route: '/gastos' },
  { table: 'notes', columns: 'id,content,category', field: 'content', type: 'Nota', route: '/notas' },
]

function clean(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }

export async function globalSearch(query) {
  const safe = query.trim().replace(/[,%()]/g, ' ')
  if (safe.length < 2) return []
  const settled = await Promise.allSettled(definitions.map(definition =>
    supabase.from(definition.table).select(definition.columns).ilike(definition.field, `%${safe}%`).limit(4)
  ))
  return settled.flatMap((result, index) => {
    if (result.status !== 'fulfilled' || result.value.error) return []
    const definition = definitions[index]
    return (result.value.data || []).map(item => ({
      id: `${definition.table}-${item.id}`, type: definition.type, title: clean(item[definition.field]).slice(0, 100),
      subtitle: clean(item.trade || item.brand || item.vendor || item.category || item.status || item.description).slice(0, 100),
      route: definition.route === '/materials' ? `/materials?search=${encodeURIComponent(clean(item.name))}` : definition.route,
    }))
  })
}
