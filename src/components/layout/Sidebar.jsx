import { NavLink } from 'react-router-dom'
import { AppIcon } from '../brand/AppIcon'
import { BrandLockup } from '../brand/Brand'
import InstallApp from '../pwa/InstallApp'
import { X } from 'lucide-react'
import { navigationLinks, navigationGroups } from './navigation'
import ProjectSwitcher from './ProjectSwitcher'

export default function Sidebar({ onNavigate, onClose }) {
  return (
    <aside className="safe-area-sidebar flex h-[100dvh] w-72 flex-col bg-stone-900 text-white shadow-[12px_0_36px_rgba(37,42,35,0.08)]">
      <div className="px-6 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup inverse />
          {onClose && <button type="button" onClick={onClose} className="-mr-2 rounded-xl p-2.5 text-white/55 hover:bg-white/10 hover:text-white" aria-label="Cerrar navegación"><X size={20} /></button>}
        </div>
        <div className="mt-6 h-px bg-white/10" />
        <div className="mt-4"><ProjectSwitcher inverse /></div>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 pb-4">
        {[{ label: null, links: [navigationLinks[0]] }, ...navigationGroups].map(group => <div key={group.label || 'overview'} className="mb-3 space-y-0.5">
          {group.label && <p className="px-3.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider text-white/60">{group.label}</p>}
          {group.links.map((link) => {
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                    : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
                }`
              }
            >
              <AppIcon name={link.icon} size={19} />
              <span>{link.label}</span>
            </NavLink>
          )
          })}
        </div>)}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <InstallApp />
        <NavLink
          to="/settings"
          onClick={onNavigate}
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
