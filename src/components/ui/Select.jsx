import { forwardRef } from 'react'

export const Select = forwardRef(function Select(
  { label, error, options = [], placeholder, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-stone-700">{label}</label>
      )}
      <select
        ref={ref}
        className={`w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 transition-all duration-200 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400/20 ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.id || opt.value} value={opt.id || opt.value}>
            {opt.name || opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
})
