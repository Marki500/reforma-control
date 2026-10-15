import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { Search, LogOut, Menu } from 'lucide-react'
import NotificationsMenu from './NotificationsMenu'
import GlobalSearch from './GlobalSearch'
import ProjectSwitcher from './ProjectSwitcher'
import { useAuth } from '../../hooks/useAuth'

export default function Header({ onMenuToggle }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.user_metadata?.display_name
    || user?.email
    || 'Cuenta'
  const accountEmail = user?.email || ''
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'N'

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="safe-area-header relative z-20 flex h-[4.25rem] items-center gap-2 border-b border-stone-200/70 bg-stone-50/90 px-3 backdrop-blur-xl sm:h-[4.5rem] sm:gap-3 sm:px-6 lg:px-8">
      <button
        onClick={onMenuToggle}
        aria-label="Abrir navegación"
        className="rounded-xl p-2 text-stone-600 transition hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta lg:hidden"
      >
        <Menu size={20} />
      </button>
      <div className="min-w-0 lg:hidden"><ProjectSwitcher compact accountLabel={displayName} /></div>

      <div className="hidden max-w-md flex-1 sm:block"><GlobalSearch /></div>

      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <button type="button" onClick={() => setMobileSearchOpen(true)} className="rounded-xl p-2.5 text-stone-500 hover:bg-white hover:text-stone-900 sm:hidden" aria-label="Buscar materiales"><Search size={19} /></button>
        <NotificationsMenu />
        <div className="hidden min-w-0 items-center gap-2.5 rounded-xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-stone-200/80 lg:flex" title={accountEmail || displayName}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-olive-light text-xs font-bold text-olive">{initials}</span>
          <span className="min-w-0 pr-1">
            <span className="block max-w-48 truncate text-xs font-semibold text-stone-800">{displayName}</span>
            {accountEmail && displayName !== accountEmail && <span className="mt-0.5 block max-w-48 truncate text-[0.66rem] text-stone-400">{accountEmail}</span>}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl p-2.5 text-sm text-stone-500 transition-all hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta sm:px-3 sm:py-2"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
      {mobileSearchOpen && <div className="absolute inset-x-0 bottom-0 top-0 flex items-center bg-stone-50 px-3 sm:hidden"><GlobalSearch mobile onClose={() => setMobileSearchOpen(false)} /></div>}
    </header>
  )
}
