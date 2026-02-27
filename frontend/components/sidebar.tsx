import { LayoutDashboard, Truck, Package, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeView: string
  onViewChange: (view: 'dashboard' | 'fleet' | 'orders' | 'alerts' | 'profile') => void
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'fleet', label: 'Fleet', icon: Truck },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  return (
    <aside className="hidden md:flex w-64 flex-col bg-secondary border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-secondary-foreground">Green Track</h1>
            <p className="text-xs text-muted-foreground">Logistics Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id as any)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    activeView === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

      {/* User Info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-foreground truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">Logistics Manager</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
