import { LayoutDashboard, Truck, Package, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  activeView: string
  onViewChange: (view: 'dashboard' | 'fleet' | 'orders' | 'alerts' | 'profile') => void
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet', label: 'Fleet', icon: Truck },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => onViewChange(item.id as any)}
                className={cn(
                  'w-full flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                  activeView === item.id
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
