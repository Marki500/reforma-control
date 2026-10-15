import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import OfflineStatus from './OfflineStatus'
import ProjectOnboarding from '../projects/ProjectOnboarding'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell flex h-[100dvh] overflow-hidden bg-stone-100">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="h-full w-72 animate-[slideIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main id="main-content" className="safe-area-main flex-1 overflow-x-hidden overflow-y-auto px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <MobileNav onMore={() => setSidebarOpen(true)} />
      <OfflineStatus />
      <ProjectOnboarding />
    </div>
  )
}
