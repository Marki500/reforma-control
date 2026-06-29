import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Receipt,
  FileText,
  Users,
  CheckSquare,
  Lightbulb,
  Image as FloorPlanIcon,
  StickyNote,
  Settings,
} from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/materials', label: 'Materiales', icon: Package },
  { to: '/planos', label: 'Planos', icon: FloorPlanIcon },
  { to: '/notas', label: 'Notas', icon: StickyNote },
  { to: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { to: '/facturas', label: 'Facturas', icon: FileText, disabled: true },
  { to: '/proveedores', label: 'Proveedores', icon: Users, disabled: true },
  { to: '/tareas', label: 'Tareas', icon: CheckSquare, disabled: true },
  { to: '/inspiracion', label: 'Inspiración', icon: Lightbulb },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-stone-200 bg-white">
      <div className="flex items-center gap-3 border-b border-stone-200 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-700 text-sm font-bold text-white">
          R
        </div>
        <div>
          <h1 className="text-sm font-semibold text-stone-800">Reforma</h1>
          <p className="text-xs text-stone-400">Control App</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const Icon = link.icon
          if (link.disabled) {
            return (
              <div
                key={link.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-300"
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </div>
            )
          }
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-stone-100 text-stone-800'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                }`
              }
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-stone-200 px-3 py-4">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
        >
          <Settings size={18} />
          <span>Ajustes</span>
        </NavLink>
      </div>
    </aside>
  )
}
