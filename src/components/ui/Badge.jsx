const statusStyles = {
  Mirando: 'bg-stone-100 text-stone-600',
  Favorito: 'bg-gold-light text-gold',
  'Pendiente de decidir': 'bg-amber-light text-amber',
  Descartado: 'bg-stone-200 text-stone-500',
  Comprado: 'bg-green-100 text-green-700',
  Recibido: 'bg-blue-100 text-blue-700',
  Devuelto: 'bg-red-100 text-red-600',
}

const priorityStyles = {
  Baja: 'bg-stone-100 text-stone-500',
  Media: 'bg-amber-light text-amber',
  Alta: 'bg-terracotta-light text-terracotta',
  Urgente: 'bg-red-100 text-red-600',
}

export function Badge({ children, type = 'status' }) {
  const styles = type === 'priority' ? priorityStyles : statusStyles

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[children] || 'bg-stone-100 text-stone-600'}`}
    >
      {children}
    </span>
  )
}
