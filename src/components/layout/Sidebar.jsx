import { NavLink } from 'react-router-dom'
import { AppIcon } from '../brand/AppIcon'
import { BrandLockup } from '../brand/Brand'

const links = [
  { to: '/dashboard', label: 'Resumen', icon: 'dashboard' },
  { to: '/materials', label: 'Materiales', icon: 'materials' },
  { to: '/planos', label: 'Planos', icon: 'plans' },
  { to: '/notas', label: 'Notas', icon: 'notes' },
  { to: '/presupuestos', label: 'Presupuestos', icon: 'budgets' },
  { to: '/gastos', label: 'Gastos', icon: 'expenses' },
  { to: '/proveedores', label: 'Proveedores', icon: 'suppliers' },
  { to: '/tareas', label: 'Tareas', icon: 'tasks' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar' },
  { to: '/progreso', label: 'Progreso', icon: 'progress' },
  { to: '/inspiracion', label: 'Inspiración', icon: 'ideas' },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-72 flex-col bg-stone-900 text-white shadow-[12px_0_36px_rgba(37,42,35,0.08)]">
      <div className="px-6 pb-6 pt-7">
        <BrandLockup inverse />
        <div className="mt-6 h-px bg-white/10" />
        <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/35">Tu proyecto</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {links.map((link) => {
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                    : 'text-white/55 hover:bg-white/[0.07] hover:text-white'
                }`
              }
            >
              <AppIcon name={link.icon} size={19} />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <NavLink
          to="/settings"
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all ${isActive ? 'bg-white text-stone-900' : 'text-white/45 hover:bg-white/[0.07] hover:text-white'}`}
        >
          <AppIcon name="settings" size={19} />
          <span>Ajustes</span>
        </NavLink>
        <p className="px-3.5 pt-4 text-[0.62rem] tracking-[0.12em] text-white/20">NIVEL · 2026</p>
      </div>
    </aside>
  )
}
