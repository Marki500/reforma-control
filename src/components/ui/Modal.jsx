import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, wide = false }) {
  const overlayRef = useRef()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 backdrop-blur-sm transition-all sm:items-start sm:overflow-y-auto sm:p-4 sm:pt-12"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full ${wide ? 'max-w-6xl' : 'max-w-lg'} animate-[fadeIn_0.2s_ease-out] overflow-y-auto rounded-t-[1.5rem] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:p-6`}>
        <div className="sticky -top-4 z-10 mb-4 flex items-center justify-between border-b border-stone-100 bg-white/95 py-2 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:py-0">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
