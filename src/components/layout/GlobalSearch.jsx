import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../../services/globalSearchService'

export default function GlobalSearch({ mobile = false, onClose }) {
  const navigate = useNavigate(), timer = useRef(), [query, setQuery] = useState(''), [results, setResults] = useState([]), [loading, setLoading] = useState(false), [open, setOpen] = useState(mobile)
  useEffect(() => () => clearTimeout(timer.current), [])
  function change(value) {
    setQuery(value); clearTimeout(timer.current)
    if (value.trim().length < 2) { setResults([]); setLoading(false); return }
    setLoading(true); setOpen(true)
    timer.current = setTimeout(() => globalSearch(value).then(setResults).finally(() => setLoading(false)), 250)
  }
  function go(result) { navigate(result.route); setOpen(false); setQuery(''); onClose?.() }
  return <div className="relative flex-1">
    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
    <input autoFocus={mobile} type="search" aria-label="Buscar en toda la aplicación" placeholder="Buscar en NIVEL…" value={query} onFocus={() => query.length >= 2 && setOpen(true)} onChange={event => change(event.target.value)} className="w-full rounded-xl border border-stone-200/80 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-stone-700 outline-none focus:border-terracotta/60 focus:ring-2 focus:ring-terracotta/10" />
    {mobile && <button type="button" onClick={onClose} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-400" aria-label="Cerrar búsqueda"><X size={18} /></button>}
    {open && query.length >= 2 && <><button type="button" className="fixed inset-0 z-[-1] cursor-default" aria-label="Cerrar resultados" onClick={() => setOpen(false)} /><div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(26rem,65dvh)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">{loading ? <p className="p-4 text-center text-sm text-stone-500">Buscando…</p> : results.length ? results.map(result => <button type="button" key={result.id} onClick={() => go(result)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"><span className="mt-0.5 rounded-md bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">{result.type}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-stone-800">{result.title}</span>{result.subtitle && <span className="block truncate text-xs text-stone-500">{result.subtitle}</span>}</span></button>) : <p className="p-4 text-center text-sm text-stone-500">No hay resultados.</p>}</div></>}
  </div>
}
