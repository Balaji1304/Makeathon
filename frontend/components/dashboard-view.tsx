'use client'

import { Card } from '@/components/ui/card'
import { Battery, Fuel, TrendingUp, TrendingDown, Leaf, DollarSign, Package, MapPin, Loader2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import useSWR from 'swr'
import { fetchDashboardData, type DashboardData } from '@/lib/api'

const ICON_MAP: Record<string, typeof Leaf> = {
  'CO₂ Emissions': Leaf,
  'Distance Traveled': MapPin,
  'Orders Fulfilled': Package,
  'Cost Savings': DollarSign,
}

const COLOR_MAP: Record<string, string> = {
  'CO₂ Emissions': 'text-primary',
  'Distance Traveled': 'text-info',
  'Orders Fulfilled': 'text-chart-2',
  'Cost Savings': 'text-warning',
}

const fallbackData: DashboardData = {
  kpis: [
    { label: 'CO₂ Emissions', value: '1,247 kg', change: '-12%', trend: 'down' },
    { label: 'Distance Traveled', value: '8,542 km', change: '+8%', trend: 'up' },
    { label: 'Orders Fulfilled', value: '342', change: '+15%', trend: 'up' },
    { label: 'Cost Savings', value: '$12,450', change: '+22%', trend: 'up' },
  ],
  fleetOverview: [
    { type: 'Electric', count: 12, active: 8, utilization: 67 },
    { type: 'Combustion', count: 18, active: 14, utilization: 78 },
  ],
  quickStats: { totalVehicles: 30, activeRoutes: 22, pendingOrders: 47, ecoScore: 'Excellent' },
}

export function DashboardView() {
  const { data, error, isLoading, mutate } = useSWR('dashboard', fetchDashboardData, {
    fallbackData,
    revalidateOnFocus: true,
    refreshInterval: 30000,
    onError: () => {},
  })

  const kpis = (data?.kpis ?? fallbackData.kpis).map((kpi) => ({
    ...kpi,
    icon: ICON_MAP[kpi.label] ?? Package,
    color: COLOR_MAP[kpi.label] ?? 'text-muted-foreground',
  }))

  const vehicles = data?.fleetOverview ?? fallbackData.fleetOverview
  const quickStats = data?.quickStats ?? fallbackData.quickStats

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your logistics overview</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Syncing...
          </div>
        )}
        {error && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-2">
            <AlertCircle className="w-4 h-4 text-accent" />
            Retry
          </Button>
        )}
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown
          return (
            <Card key={kpi.label} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-2">{kpi.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendIcon className={`w-4 h-4 ${kpi.trend === 'down' ? 'text-primary' : 'text-chart-2'}`} />
                    <span className={`text-sm font-medium ${kpi.trend === 'down' ? 'text-primary' : 'text-chart-2'}`}>
                      {kpi.change}
                    </span>
                    <span className="text-sm text-muted-foreground">vs last month</span>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Fleet Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-xl font-semibold mb-4">Fleet Overview</h2>
          <div className="space-y-6">
            {vehicles.map((vehicle) => (
              <div key={vehicle.type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {vehicle.type === 'Electric' ? (
                      <Battery className="w-5 h-5 text-primary" />
                    ) : (
                      <Fuel className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{vehicle.type}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {vehicle.active}/{vehicle.count} active
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${vehicle.type === 'Electric' ? 'bg-primary' : 'bg-muted-foreground'}`}
                      style={{ width: `${vehicle.utilization}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium min-w-[3rem] text-right">{vehicle.utilization}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Total Vehicles</span>
                <span className="text-lg font-bold">{quickStats.totalVehicles}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Active Routes</span>
                <span className="text-lg font-bold">{quickStats.activeRoutes}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Pending Orders</span>
                <span className="text-lg font-bold">{quickStats.pendingOrders}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Eco Score</span>
                <Badge className="bg-primary text-primary-foreground">{quickStats.ecoScore}</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Interactive Map Placeholder */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Delivery Routes Map</h2>
        <div className="relative h-96 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Interactive map view</p>
            <p className="text-sm text-muted-foreground mt-1">Shows delivery routes, stops, and depot locations</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
