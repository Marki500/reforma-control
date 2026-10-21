// Manual visual regression fixture. No Supabase client, credentials or real records.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '../src/components/layout/AppLayout'
import Dashboard from '../src/pages/Dashboard'
import Materials from '../src/pages/Materials'
import Invoices from '../src/pages/Invoices'
import ReportTools from '../src/components/settings/ReportTools'
import BudgetPDFs from '../src/pages/BudgetPDFs'
import Expenses from '../src/pages/Expenses'
import FloorPlan from '../src/pages/FloorPlan'
import '../src/index.css'
// Browser-only fixture file: exercises React's normal change handler without
// reading local files or requesting extension file-system permissions.
document.addEventListener('click', async event => {
  const button = event.target.closest('button, [data-test-budget]')
  if (!button || !['Seleccionar documento', 'Cambiar documento'].includes(button.textContent.trim()) && !button.textContent.includes('Haz clic o arrastra un PDF')) return
  const input = document.querySelector('input[type="file"]')
  if (!input) return
  event.preventDefault(); event.stopPropagation()
  const transfer = new DataTransfer(); transfer.items.add(new File([await (await fetch('/fixture.pdf')).arrayBuffer()], 'documento-demo.pdf', { type: 'application/pdf' }))
  input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
}, true)
new MutationObserver(() => { for (const element of document.querySelectorAll('div[role="dialog"] div')) if (element.textContent.startsWith('Haz clic o arrastra un PDF') && element.className.includes('cursor-pointer')) element.setAttribute('data-test-budget', 'true') }).observe(document.body, { childList: true, subtree: true })
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route element={<AppLayout />}><Route path="/planos" element={<FloorPlan />} /><Route path="/informes" element={<ReportTools />} /><Route path="/presupuestos" element={<BudgetPDFs />} /><Route path="/materials" element={<Materials />} /><Route path="/facturas" element={<Invoices />} /><Route path="/gastos" element={<Expenses />} /><Route path="*" element={<Dashboard />} /></Route></Routes></BrowserRouter>)
