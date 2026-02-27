'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, MapPin, Loader2, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { fetchOrdersData, type OrdersData } from '@/lib/api'

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

export function OrdersView() {
  const { data, error, isLoading, mutate } = useSWR('orders', fetchOrdersData, {
    fallbackData,
    revalidateOnFocus: true,
    refreshInterval: 30000,
    onError: () => {},
  })

  const orders = data?.orders ?? fallbackData.orders
  const scenarios = data?.scenarios ?? fallbackData.scenarios

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

      {/* Orders Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Customer Orders</h2>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="assigned">Assigned</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{order.id}</span>
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
                      <Button size="sm" variant="outline" className="flex-1 lg:flex-none">
                        Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
