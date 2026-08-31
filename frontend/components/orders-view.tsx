'use client'

import { useState, useRef } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, MapPin, Loader2, AlertCircle, Filter, Activity } from 'lucide-react'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { fetchOrdersData, fetchRouteMap, type OrdersData, type RouteMapOrder } from '@/lib/api'
import { OrderDetailsModal } from '@/components/order-details-modal'

const fallbackData: OrdersData = {
  orders: [
    { id: 'ORD-1847', origin: 'Warehouse A, Berlin', destination: 'Customer Site, Munich', weight: '850 kg', priority: 'high', emissions: '45 kg CO₂', status: 'assigned', route: 'Route 12' },
    { id: 'ORD-1848', origin: 'Depot B, Hamburg', destination: 'Distribution Center, Frankfurt', weight: '1,200 kg', priority: 'medium', emissions: '68 kg CO₂', status: 'pending', route: null },
    { id: 'ORD-1849', origin: 'Warehouse C, Cologne', destination: 'Customer Site, Dortmund', weight: '450 kg', priority: 'low', emissions: '0 kg CO₂', status: 'completed', route: 'Route 8' },
    { id: 'ORD-1850', origin: 'Depot A, Berlin', destination: 'Customer Site, Leipzig', weight: '2,100 kg', priority: 'high', emissions: '95 kg CO₂', status: 'pending', route: null },
  ],
  scenarios: [
    { name: 'Normal Planning', duration: '4.5 hours', emissions: '208 kg CO₂', cost: '€450', efficiency: 78 },
    { name: 'Eco Planning', duration: '5.2 hours', emissions: '113 kg CO₂', cost: '€425', efficiency: 92, recommended: true },
  ],
}

const RouteMap = dynamic(() => import('@/components/route-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full flex items-center justify-center bg-muted rounded-xl border border-border">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p>Loading interactive map...</p>
      </div>
    </div>
  )
})

const SimulationPanel = dynamic(() => import('@/components/simulation-panel'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] w-full flex items-center justify-center bg-muted rounded-xl border border-border">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )
})

export function OrdersView() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [mapFilterOrderId, setMapFilterOrderId] = useState<number | null>(null)
  const [healthFilter, setHealthFilter] = useState<string>('all')
  const simPanelRef = useRef<HTMLDivElement>(null)

  const { data, error, isLoading, mutate } = useSWR('orders', fetchOrdersData, {
    fallbackData,
    revalidateOnFocus: true,
    refreshInterval: 30000,
    onError: () => { },
  })

  const { data: routeData } = useSWR('routes-map', fetchRouteMap, {
    revalidateOnFocus: false
  })

  const orders = data?.orders ?? fallbackData.orders
  const scenarios = data?.scenarios ?? fallbackData.scenarios
  const routes: RouteMapOrder[] = routeData || []

  const routeSummary = routes.reduce((acc, r) => {
    const ratio = r.avg_load_ratio
    if (ratio >= 0.70) acc.optimal++
    else if (ratio >= 0.35) acc.moderate++
    else acc.low++
    return acc
  }, { optimal: 0, moderate: 0, low: 0 })

  const routeHealthMap = new Map(
    routes.map(r => [r.order_id, r.avg_load_ratio >= 0.70 ? 'optimal' : r.avg_load_ratio >= 0.35 ? 'moderate' : 'low'] as const)
  )

  const ordersWithHealth = orders.map(order => {
    const numericId = parseInt(order.id.replace('ORD-', ''))
    const health = routeHealthMap.get(numericId)
    return { ...order, routeHealth: health ?? order.routeHealth }
  })

  const filteredOrders = ordersWithHealth.filter(order => {
    if (healthFilter === 'all') return true
    return order.routeHealth === healthFilter
  })

  const filteredRoutes = healthFilter === 'all'
    ? routes
    : routes.filter(r => {
        const ratio = r.avg_load_ratio
        if (healthFilter === 'optimal') return ratio >= 0.70
        if (healthFilter === 'moderate') return ratio >= 0.35 && ratio < 0.70
        if (healthFilter === 'low') return ratio < 0.35
        return true
      })

  const handleOpenSimulator = (orderId: number) => {
    setSelectedOrderId(`ORD-${orderId}`)
    setModalOpen(false)
    setTimeout(() => {
      simPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order & Route Planning</h1>
            <p className="text-muted-foreground mt-1">Manage deliveries and optimize routes</p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Package className="w-4 h-4" />
              New Order
            </Button>
          </div>
        </div>
      </div>

      {/* Map + Route Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Live Route Visualization</h2>
              <p className="text-sm text-muted-foreground">Click a route to filter, or select an order below</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 px-3 py-1">
                <MapPin className="w-3 h-3" />
                {filteredRoutes.length} Routes
                {healthFilter !== 'all' && (
                  <span className="text-muted-foreground ml-1">({routes.length} total)</span>
                )}
              </Badge>
              {(mapFilterOrderId || healthFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMapFilterOrderId(null); setHealthFilter('all') }}
                  className="gap-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>

          <RouteMap
            orders={filteredRoutes}
            height="450px"
            selectedOrderId={mapFilterOrderId}
            onOrderSelect={(id) => setMapFilterOrderId(id === mapFilterOrderId ? null : id)}
          />
        </Card>

        {/* Route Stats Sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Route Health</h3>
            <div className="space-y-2">
              <button
                onClick={() => setHealthFilter(healthFilter === 'all' ? 'all' : 'all')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                  healthFilter === 'all' ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#ef4444]"></div>
                  <span className="text-sm font-medium">All Routes</span>
                </div>
                <Badge variant="outline" className="font-bold">{routes.length}</Badge>
              </button>

              <button
                onClick={() => setHealthFilter(healthFilter === 'optimal' ? 'all' : 'optimal')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                  healthFilter === 'optimal' ? 'bg-[#10b981]/10 border border-[#10b981]/30' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                  <span className="text-sm font-medium">Optimal</span>
                </div>
                <Badge variant="outline" className="font-bold text-[#10b981] border-[#10b981]/30">{routeSummary.optimal}</Badge>
              </button>

              <button
                onClick={() => setHealthFilter(healthFilter === 'moderate' ? 'all' : 'moderate')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                  healthFilter === 'moderate' ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/30' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                  <span className="text-sm font-medium">Moderate</span>
                </div>
                <Badge variant="outline" className="font-bold text-[#f59e0b] border-[#f59e0b]/30">{routeSummary.moderate}</Badge>
              </button>

              <button
                onClick={() => setHealthFilter(healthFilter === 'low' ? 'all' : 'low')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                  healthFilter === 'low' ? 'bg-[#ef4444]/10 border border-[#ef4444]/30' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                  <span className="text-sm font-medium">Low Utilization</span>
                </div>
                <Badge variant="outline" className="font-bold text-[#ef4444] border-[#ef4444]/30">{routeSummary.low}</Badge>
              </button>
            </div>
          </Card>

          {mapFilterOrderId && (
            <Card className="p-5 border-primary/50">
              <h3 className="font-semibold text-sm text-primary mb-2">Filtered Route</h3>
              <p className="text-xs text-muted-foreground">
                Viewing order <span className="font-bold text-foreground">#{mapFilterOrderId}</span> only.
                Click "Clear filter" to see all routes.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Scenario Comparison */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Scenario Comparison</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.name}
              className={`p-5 ${scenario.recommended ? 'border-primary border-2' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-lg">{scenario.name}</h3>
                {scenario.recommended && (
                  <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="font-medium">{scenario.duration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Emissions</span>
                  <span className={`font-medium ${scenario.recommended ? 'text-primary' : ''}`}>
                    {scenario.emissions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cost</span>
                  <span className="font-medium">{scenario.cost}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Efficiency</span>
                    <span className="font-medium">{scenario.efficiency}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${scenario.recommended ? 'bg-primary' : 'bg-muted-foreground'}`}
                      style={{ width: `${scenario.efficiency}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Simulation Panel */}
      <div ref={simPanelRef}>
        <SimulationPanel
          selectedOrderId={selectedOrderId ? parseInt(selectedOrderId.replace('ORD-', '')) : null}
          onOrderSelect={(id) => setSelectedOrderId(`ORD-${id}`)}
        />
      </div>

      {/* Orders Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Customer Orders</h2>
          <div className="flex items-center gap-2">
            {mapFilterOrderId && (
              <Badge variant="outline" className="gap-1">
                <Filter className="w-3 h-3" />
                Map: #{mapFilterOrderId}
              </Badge>
            )}
            {healthFilter !== 'all' && (
              <Badge variant="outline" className="gap-1">
                <Activity className="w-3 h-3" />
                Health: {healthFilter}
                <button
                  onClick={() => setHealthFilter('all')}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="assigned">Assigned</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-3">
              {filteredOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No orders match the selected health filter.
                </p>
              )}
              {filteredOrders.map((order) => {
                const numericId = parseInt(order.id.replace('ORD-', ''))
                const isMapHighlighted = mapFilterOrderId === numericId
                return (
                  <Card
                    key={order.id}
                    className={`p-4 transition-all ${isMapHighlighted ? 'border-primary border-2 shadow-md' : ''}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{order.id}</span>
                            {isMapHighlighted && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">ON MAP</Badge>
                            )}
                          </div>
                          <Badge
                            variant={order.priority === 'high' ? 'destructive' : 'secondary'}
                            className={
                              order.priority === 'high'
                                ? 'bg-accent text-accent-foreground'
                                : order.priority === 'medium'
                                  ? 'bg-chart-2 text-primary-foreground'
                                  : ''
                            }
                          >
                            {order.priority} priority
                          </Badge>
                          {order.routeHealth && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                order.routeHealth === 'optimal'
                                  ? 'border-[#10b981] text-[#10b981]'
                                  : order.routeHealth === 'moderate'
                                    ? 'border-[#f59e0b] text-[#f59e0b]'
                                    : 'border-[#ef4444] text-[#ef4444]'
                              }`}
                            >
                              {order.routeHealth === 'optimal' ? 'Optimal' : order.routeHealth === 'moderate' ? 'Moderate' : 'Low Util.'}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">From: {order.origin}</p>
                              <p className="text-muted-foreground">To: {order.destination}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Weight:</span>
                            <span className="font-medium">{order.weight}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Emissions:</span>
                            <span className={`font-medium ${order.emissions === '0 kg CO₂' ? 'text-primary' : ''}`}>
                              {order.emissions}
                            </span>
                          </div>
                          {order.route && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Route:</span>
                              <span className="font-medium">{order.route}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex lg:flex-col gap-2">
                        <Button size="sm" variant="outline" className="flex-1 lg:flex-none">
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant={isMapHighlighted ? "default" : "outline"}
                          className="flex-1 lg:flex-none"
                          onClick={() => { setSelectedOrderId(order.id); setModalOpen(true) }}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 lg:flex-none text-xs"
                          onClick={() => setMapFilterOrderId(numericId === mapFilterOrderId ? null : numericId)}
                        >
                          {isMapHighlighted ? 'Show All' : 'Show on Map'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <OrderDetailsModal
        orderId={selectedOrderId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenSimulator={handleOpenSimulator}
      />
    </div>
  )
}
