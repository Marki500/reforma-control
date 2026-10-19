// Manual visual regression fixture. No Supabase client, credentials or real records.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '../src/components/layout/AppLayout'
import Dashboard from '../src/pages/Dashboard'
import Materials from '../src/pages/Materials'
import '../src/index.css'
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route element={<AppLayout />}><Route path="/materials" element={<Materials />} /><Route path="*" element={<Dashboard />} /></Route></Routes></BrowserRouter>)
