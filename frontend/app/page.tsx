'use client'

import { useState } from 'react'
import { DashboardView } from '@/components/dashboard-view'
import { FleetView } from '@/components/fleet-view'
import { OrdersView } from '@/components/orders-view'
import { AlertsView } from '@/components/alerts-view'
import { ProfileView } from '@/components/profile-view'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'

export default function Home() {
  const [activeView, setActiveView] = useState<'dashboard' | 'fleet' | 'orders' | 'alerts' | 'profile'>('dashboard')

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'fleet' && <FleetView />}
        {activeView === 'orders' && <OrdersView />}
        {activeView === 'alerts' && <AlertsView />}
        {activeView === 'profile' && <ProfileView />}
      </main>

      {/* Mobile Navigation */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  )
}
