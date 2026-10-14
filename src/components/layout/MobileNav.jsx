import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { AppIcon } from '../brand/AppIcon'
import { mobilePrimaryLinks } from './navigation'

export default function MobileNav({ onMore }) {
  const itemClass = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pb-2 pt-2.5 text-[0.65rem] font-medium transition-colors'

  return (
    <nav aria-label="Navegación principal" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-stone-50/95 shadow-[0_-10px_30px_rgba(37,42,35,0.08)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-[4.25rem] max-w-lg items-stretch px-2">
        {mobilePrimaryLinks.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => `${itemClass} ${isActive ? 'text-terracotta' : 'text-stone-500'}`}>
            <AppIcon name={link.icon} size={21} />
            <span className="truncate">{link.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className={`${itemClass} text-stone-500`} aria-label="Abrir más secciones">
          <Menu size={21} strokeWidth={1.7} />
          <span>Más</span>
        </button>
      </div>
    </nav>
  )
}
