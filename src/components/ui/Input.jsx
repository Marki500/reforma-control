import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export const Input = forwardRef(function Input(
  { label, error, className = '', type = 'text', id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-stone-700">{label}</label>
      )}
      <div className="relative">
      <input
        ref={ref}
        id={inputId}
        type={isPassword && visible ? 'text' : type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-800 placeholder:text-stone-400 transition-all duration-200 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20 min-h-[44px] ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-400/20' : ''} ${className}`}
        {...props}
        style={isPassword ? { ...props.style, paddingRight: '3.25rem' } : props.style}
      />
      {isPassword && <button type="button" onClick={() => setVisible(value => !value)} disabled={props.disabled} aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label || 'contraseña'}`} aria-controls={inputId} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500">
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>}
      </div>
      {error && <p id={`${inputId}-error`} className="text-sm text-red-500">{error}</p>}
    </div>
  )
})
