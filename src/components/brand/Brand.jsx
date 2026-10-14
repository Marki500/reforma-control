export function BrandMark({ className = '', title = 'NIVEL' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label={title}>
      <rect width="48" height="48" rx="13" fill="currentColor" />
      <path d="M11 35V13h7.2l11.6 13.4V13H37v22h-7.1L18.2 21.5V35H11Z" fill="#F4F0E7" />
      <circle cx="24" cy="24" r="2.7" fill="#D86D4D" stroke="#F4F0E7" strokeWidth="1.6" />
    </svg>
  )
}

export function BrandLockup({ compact = false, inverse = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BrandMark className={`h-10 w-10 shrink-0 ${inverse ? 'text-terracotta' : 'text-stone-900'}`} />
      {!compact && <div className="leading-none">
        <p className={`font-display text-[1.05rem] font-bold tracking-[0.16em] ${inverse ? 'text-white' : 'text-stone-900'}`}>NIVEL</p>
        <p className={`mt-1.5 text-[0.64rem] font-medium tracking-[0.08em] ${inverse ? 'text-white/45' : 'text-stone-500'}`}>CONTROL DE OBRA</p>
      </div>}
    </div>
  )
}
