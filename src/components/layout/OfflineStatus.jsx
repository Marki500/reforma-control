import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
export default function OfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  if (online) return null
  return <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-medium text-white shadow-xl"><WifiOff size={15} />Sin conexión. Los datos nuevos y los cambios requieren internet.</div>
}
