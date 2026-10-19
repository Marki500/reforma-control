import { supabase } from './supabaseClient'

const tables = ['home_info', 'home_documents', 'materials', 'material_categories', 'rooms', 'tasks', 'task_items', 'suppliers', 'budget_pdfs', 'invoices', 'expenses', 'notes', 'floor_plans', 'progress_photos', 'inspirations', 'category_budgets', 'dashboard_grid_config', 'dashboard_grid_cells']

function download(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadBackup() {
  const results = await Promise.allSettled(tables.map(table => supabase.from(table).select('*')))
  const data = {}
  results.forEach((result, index) => { if (result.status === 'fulfilled' && !result.value.error) data[tables[index]] = result.value.data || [] })
  download(`nivel-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data }, null, 2), 'application/json')
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
export async function downloadCsv(table, filename) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw error
  const rows = data || []; if (!rows.length) throw new Error('No hay datos para exportar.')
  const headers = Object.keys(rows[0])
  const csv = '\uFEFF' + [headers.map(csvCell).join(';'), ...rows.map(row => headers.map(header => csvCell(row[header])).join(';'))].join('\r\n')
  download(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
}
