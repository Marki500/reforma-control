import { forwardRef } from 'react'

const variants = {
  primary: 'bg-stone-700 text-white hover:bg-stone-800 focus-visible:ring-stone-500',
  secondary: 'bg-stone-200 text-stone-700 hover:bg-stone-300 focus-visible:ring-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-200 focus-visible:ring-stone-400',
  danger: 'bg-terracotta text-white hover:bg-red-700 focus-visible:ring-red-500',
  olive: 'bg-olive text-white hover:bg-stone-600 focus-visible:ring-olive',
}

const sizes = {
  sm: 'px-3 py-2 text-sm min-h-[44px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-5 py-3 text-base min-h-[48px]',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})
