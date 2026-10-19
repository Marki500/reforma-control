// Manual visual regression fixture. No Supabase client, credentials or real records.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '../src/components/layout/AppLayout'
import Dashboard from '../src/pages/Dashboard'
import Materials from '../src/pages/Materials'
import Invoices from '../src/pages/Invoices'
import Expenses from '../src/pages/Expenses'
import '../src/index.css'
// Browser-only fixture file: exercises React's normal change handler without
// reading local files or requesting extension file-system permissions.
document.addEventListener('click', event => {
  const button = event.target.closest('button')
  if (!button || !['Seleccionar documento', 'Cambiar documento'].includes(button.textContent.trim())) return
  const input = document.querySelector('input[type="file"]')
  if (!input) return
  event.preventDefault(); event.stopPropagation()
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHMkAAAAASUVORK5CYII='), character => character.charCodeAt(0))
  const transfer = new DataTransfer(); transfer.items.add(new File([png], 'factura-demo.png', { type: 'image/png' }))
  input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
}, true)
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route element={<AppLayout />}><Route path="/materials" element={<Materials />} /><Route path="/facturas" element={<Invoices />} /><Route path="/gastos" element={<Expenses />} /><Route path="*" element={<Dashboard />} /></Route></Routes></BrowserRouter>)
