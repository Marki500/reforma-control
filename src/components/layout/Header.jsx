import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { Search, LogOut, Menu } from 'lucide-react'

export default function Header({ onMenuToggle, onSearch }) {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')

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
    <header className="flex h-16 items-center gap-4 border-b border-stone-200 bg-white px-6">
      <button
        onClick={onMenuToggle}
        className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          type="text"
          placeholder="Buscar materiales..."
          value={searchValue}
          onChange={handleSearchChange}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-10 pr-4 text-sm text-stone-700 placeholder:text-stone-400 transition-all focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-400/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
