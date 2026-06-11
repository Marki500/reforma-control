import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-stone-700">{label}</label>
      )}
      <input
        ref={ref}
        className={`w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-800 placeholder:text-stone-400 transition-all duration-200 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20 min-h-[44px] ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-400/20' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
})
