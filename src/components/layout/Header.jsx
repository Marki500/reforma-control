import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { Search, LogOut, Menu, X } from 'lucide-react'
import NotificationsMenu from './NotificationsMenu'
import { BrandMark } from '../brand/Brand'

export default function Header({ onMenuToggle, onSearch }) {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function handleSearchChange(e) {
    const value = e.target.value
    setSearchValue(value)
    onSearch?.(value)
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
      <BrandMark className="h-7 w-7 text-stone-900 sm:h-8 sm:w-8 lg:hidden" />

      <div className="relative hidden max-w-md flex-1 sm:block lg:ml-0">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          type="text"
          placeholder="Buscar materiales..."
          value={searchValue}
          onChange={handleSearchChange}
          className="w-full rounded-xl border border-stone-200/80 bg-white/75 py-2.5 pl-10 pr-4 text-sm text-stone-700 shadow-[0_1px_0_rgba(37,42,35,0.04)] placeholder:text-stone-400 transition-all focus:border-terracotta/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/10"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <button type="button" onClick={() => setMobileSearchOpen(true)} className="rounded-xl p-2.5 text-stone-500 hover:bg-white hover:text-stone-900 sm:hidden" aria-label="Buscar materiales"><Search size={19} /></button>
        <NotificationsMenu />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl p-2.5 text-sm text-stone-500 transition-all hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta sm:px-3 sm:py-2"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
      {mobileSearchOpen && <div className="absolute inset-x-0 bottom-0 top-0 flex items-center gap-2 bg-stone-50 px-3 sm:hidden">
        <div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" /><input autoFocus type="search" placeholder="Buscar materiales..." value={searchValue} onChange={handleSearchChange} className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/10" /></div>
        <button type="button" onClick={() => setMobileSearchOpen(false)} className="rounded-xl p-2.5 text-stone-500" aria-label="Cerrar búsqueda"><X size={20} /></button>
      </div>}
    </header>
  )
}
