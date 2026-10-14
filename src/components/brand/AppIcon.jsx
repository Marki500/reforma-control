const drawings = {
  dashboard: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10.5V20h11v-9.5M10 20v-5h4v5" /></>,
  materials: <><path d="m5 8 7-4 7 4-7 4-7-4Z" /><path d="m5 12 7 4 7-4M5 16l7 4 7-4" /></>,
  plans: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v5h4M8 13h8M8 17h5" /></>,
  home: <><path d="m3.5 11.5 8.5-7 8.5 7" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
  notes: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  budgets: <><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 13h5M15.5 16.5h.01" /></>,
  expenses: <><path d="M4 8h16v11H4z" /><path d="M4 11h16M8 15h3" /></>,
  suppliers: <><path d="M4 20v-9l8-5 8 5v9" /><path d="M8 20v-6h8v6M9 9.5h6" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.3 1.3L7 4.8M3.5 12l1.3 1.3L7 10.8M3.5 18l1.3 1.3L7 16.8" /></>,
  calendar: <><path d="M5 7h14v13H5zM8 4v6M16 4v6M5 11h14" /><path d="M9 15h.01M13 15h.01M17 15h.01" /></>,
  progress: <><path d="M5 7h4l1.5-2h3L15 7h4v12H5z" /><circle cx="12" cy="13" r="3.5" /></>,
  ideas: <><path d="M9 18h6M10 21h4" /><path d="M8 14.5a7 7 0 1 1 8 0c-1 .8-1 1.5-1 1.5H9s0-.7-1-1.5Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  install: <><path d="M12 3v11M8 10l4 4 4-4" /><path d="M5 16v4h14v-4" /></>,
}

export function AppIcon({ name, size = 20, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {drawings[name] || drawings.dashboard}
    </svg>
  )
}
