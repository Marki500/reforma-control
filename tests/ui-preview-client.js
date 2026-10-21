const today = new Date()
const dateKey = offset => { const date = new Date(today); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const project = { project_id: 'demo', workspace_owner_id: 'demo-user', project_name: 'Reforma de ejemplo', name: 'Reforma de ejemplo', role: 'owner', estimated_budget: 5000, setup_completed: true, is_active: true }
const materials = [
  { id: 'm1', name: 'Grifo de lavabo monomando caño alto en acabado latón cepillado', price: 249, quantity: 2, category_id: 'bath', status: 'Mirando', priority: 'Media', store_name: 'tienda.example', product_url: 'https://tienda.example/grifo', material_categories: { name: 'Baño' }, rooms: { name: 'Baño principal' } },
  { id: 'm2', name: 'Ventana de PVC con apertura oscilobatiente y doble acristalamiento 150 × 120 cm', price: 391.47, quantity: 4, category_id: 'windows', status: 'Comprado', priority: 'Alta', store_name: 'Ventanas Ejemplo', product_url: 'https://ventanas.example/producto', material_categories: { name: 'Ventanas' } },
  { id: 'm3', name: 'Mueble de baño suspendido de roble con dos cajones y encimera', price: 736, quantity: 1, category_id: 'bath', status: 'Favorito', priority: 'Media', material_categories: { name: 'Baño' } },
]
const tables = {
  materials,
  material_categories: [{ id: 'bath', name: 'Baño' }, { id: 'windows', name: 'Ventanas' }],
  rooms: [{ id: 'room1', name: 'Baño principal' }],
  expenses: [{ id: 'e1', title: 'Segundo pago de carpintería', amount: 2400, paid_amount: 600, due_date: dateKey(3) }],
  tasks: [{ id: 't1', title: 'Confirmar medidas de las ventanas', description: '', status: 'Pendiente', due_date: dateKey(0) }],
  notes: [{ id: 'n1', category: 'Resumen', content: '<p>Confirmar acabados de grifería y fecha de entrega de las ventanas.</p>', created_at: today.toISOString() }],
  category_budgets: [{ category_id: 'bath', budget_amount: 1800 }, { category_id: 'windows', budget_amount: 2000 }],
  dashboard_grid_config: [{ num_columns: 2, num_rows: 1 }],
  dashboard_grid_cells: [{ row_index: 0, col_index: 0, category_id: 'bath', budget_amount: 1800, material_categories: { name: 'Baño' } }, { row_index: 0, col_index: 1, category_id: 'windows', budget_amount: 2000, material_categories: { name: 'Ventanas' } }],
}
const demoInvoice = { id: 'sample-invoice', name: 'Instalación eléctrica del baño', supplier_name: 'Instalaciones Norte', invoice_number: 'FN-26-014', issued_date: '2026-10-15', total_amount: 121, supplier_tax_id: 'B87654321', file_type: 'application/pdf', file_path: 'demo/sample.pdf', expense_id: 'e2', expenses: { id: 'e2', amount: 121, paid_amount: 121 } }
tables.invoices = [demoInvoice]
tables.expenses.push({ id: 'e2', title: demoInvoice.name, amount: 121, paid_amount: 121, category: 'Mano de obra', invoices: [{ id: demoInvoice.id, invoice_number: demoInvoice.invoice_number }], notes: '', vendor: demoInvoice.supplier_name })
tables.budget_pdfs = [{ id: 'quote1', name: 'Carpintería de ventanas', status: 'Aceptado', expense_id: 'e1' }]
tables.expenses[0].payment_phases = [
  { id: 'phase-1', title: 'Anticipo', amount: 600, paid: true, paid_date: '2026-10-01', due_date: null },
  { id: 'phase-2', title: 'Durante la obra', amount: 1000, paid: false, paid_date: null, due_date: dateKey(3) },
  { id: 'phase-3', title: 'Liquidación', amount: 800, paid: false, paid_date: null, due_date: dateKey(30) },
]
tables.expenses[0].payment_plan_version = 0
const files = new Map()
const attempts = {}
export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'demo-user' } } }),
    getSession: async () => ({ data: { session: { access_token: 'preview-only-token', user: { id: 'demo-user', email: 'demo@example.com' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  async rpc(name, params) {
    if (name === 'resolve_budget_supplier_upload') return { data: { saved: tables.budget_pdfs.some(item => item.id === params.p_id) } }
    if (name === 'create_budget_with_supplier') {
      const existing = tables.budget_pdfs.find(item => item.id === params.p_budget.id)
      if (existing) return { data: { id: existing.id, supplier_id: existing.supplier_id } }
      const supplier = { id: `supplier-${params.p_budget.id}`, ...params.p_supplier, status: 'Candidato', contacted: false, trade: 'Otro' }
      tables.suppliers ||= []; tables.suppliers.push(supplier)
      tables.budget_pdfs.push({ ...params.p_budget, supplier_id: supplier.id, suppliers: supplier })
      if (new URLSearchParams(location.search).has('lostResponse')) return { error: { message: 'Respuesta perdida de prueba' } }
      return { data: { id: params.p_budget.id, supplier_id: supplier.id, supplier_created: true } }
    }
    if (name === 'register_invoice') {
      const item = params.p_invoice
      const existing = tables.invoices.find(row => row.id === item.id)
      if (existing) return { data: existing.expense_id }
      const expenseId = params.p_expense_id || `expense-${item.id}`
      const expense = tables.expenses.find(row => row.id === expenseId) || { id: expenseId }
      Object.assign(expense, { title: item.name, vendor: item.supplier_name, category: item.category, amount: Number(item.total_amount), paid_amount: Number(item.paid_amount), due_date: item.due_date, notes: item.notes, invoices: [{ id: item.id, invoice_number: item.invoice_number }] })
      if (!tables.expenses.includes(expense)) tables.expenses.push(expense)
      tables.invoices.unshift({ ...item, expense_id: expenseId, expenses: expense })
      return { data: expenseId }
    }
    if (name === 'delete_invoice') { tables.invoices = tables.invoices.filter(item => item.id !== params.p_invoice_id); return {} }
    return { data: name === 'get_workspace_context' || name === 'get_project_details' ? [project] : name === 'list_user_projects_v2' ? [project] : [] }
  },
  storage: { from() { return {
    async upload(path, file) { files.set(path, URL.createObjectURL(file)); return {} },
    async createSignedUrl(path) { return { data: { signedUrl: files.get(path) || '/nivel-mark.svg' } } },
    async remove() { return {} },
  } } },
  from(table) {
    let single = false, from = 0, to = Infinity, filterId = null, patch = null
    const chain = {
      update(value) { patch = value; return chain }, range(start, end) { from = start; to = end; return chain }, select() { return chain }, order() { return chain }, eq(key, value) { if (key === 'id') filterId = value; return chain }, limit() { return chain },
      maybeSingle() { single = true; return chain }, single() { single = true; return chain },
      then(resolve, reject) {
        if (patch) { const target = tables[table]?.find(row => row.id === filterId); if (target) Object.assign(target, patch, { payment_plan_version: (target.payment_plan_version || 0) + 1 }) }
        attempts[table] = (attempts[table] || 0) + 1
        const params = new URLSearchParams(location.search)
        const error = (params.has('error') && ['materials', 'expenses'].includes(table)) || (params.has('errorOnce') && table === 'materials' && attempts[table] === 1)
        return Promise.resolve(error ? { error: new Error('No se pudo conectar. Vuelve a intentarlo.') } : { data: single ? (filterId ? tables[table]?.find(row => row.id === filterId) || null : tables[table]?.[0] || null) : (tables[table] || []).slice(from, to + 1) }).then(resolve, reject)
      },
    }
    return chain
  },
}
