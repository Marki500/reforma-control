export const navigationLinks = [
  { to: '/dashboard', label: 'Resumen', icon: 'dashboard' },
  { to: '/vivienda', label: 'Vivienda', icon: 'home' },
  { to: '/materials', label: 'Materiales', icon: 'materials' },
  { to: '/planos', label: 'Planos', icon: 'plans' },
  { to: '/notas', label: 'Notas', icon: 'notes' },
  { to: '/presupuestos', label: 'Presupuestos', icon: 'budgets' },
  { to: '/facturas', label: 'Facturas', icon: 'invoices' },
  { to: '/gastos', label: 'Gastos', icon: 'expenses' },
  { to: '/proveedores', label: 'Proveedores', icon: 'suppliers' },
  { to: '/tareas', label: 'Tareas', icon: 'tasks' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar' },
  { to: '/progreso', label: 'Progreso', icon: 'progress' },
  { to: '/inspiracion', label: 'Inspiración', icon: 'ideas' },
]

export const mobilePrimaryLinks = navigationLinks.filter(({ to }) =>
  ['/dashboard', '/materials', '/tareas', '/gastos'].includes(to)
)

export const navigationGroups = [
  { label: 'Planificación', paths: ['/vivienda', '/planos', '/notas', '/inspiracion'] },
  { label: 'Compras y costes', paths: ['/materials', '/presupuestos', '/facturas', '/gastos', '/proveedores'] },
  { label: 'Ejecución', paths: ['/tareas', '/calendario', '/progreso'] },
].map(group => ({ ...group, links: group.paths.map(path => navigationLinks.find(link => link.to === path)) }))
