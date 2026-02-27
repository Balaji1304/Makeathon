'use client'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Battery, Fuel, MapPin, Loader2, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { fetchVehicles, type Vehicle } from '@/lib/api'
import { useState, useMemo } from 'react'

const fallbackVehicles: Vehicle[] = [
  { id: 'VH-001', type: 'Electric Van', tonnage: '3.5t', fuel: 'electric', emissions: '0 kg CO₂', status: 'active', location: 'En route to Depot B', battery: 78 },
  { id: 'VH-002', type: 'Diesel Truck', tonnage: '12t', fuel: 'combustion', emissions: '245 kg CO₂', status: 'active', location: 'Delivering to Zone 3', battery: null },
  { id: 'VH-003', type: 'Electric Van', tonnage: '3.5t', fuel: 'electric', emissions: '0 kg CO₂', status: 'idle', location: 'Depot A', battery: 95 },
  { id: 'VH-004', type: 'Hybrid Truck', tonnage: '7.5t', fuel: 'hybrid', emissions: '120 kg CO₂', status: 'maintenance', location: 'Service Center', battery: null },
  { id: 'VH-005', type: 'Electric Truck', tonnage: '12t', fuel: 'electric', emissions: '0 kg CO₂', status: 'active', location: 'Highway Route 45', battery: 52 },
  { id: 'VH-006', type: 'Diesel Van', tonnage: '3.5t', fuel: 'combustion', emissions: '180 kg CO₂', status: 'idle', location: 'Depot C', battery: null },
]

export function FleetView() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data, error, isLoading, mutate } = useSWR('vehicles', fetchVehicles, {
    fallbackData: fallbackVehicles,
    revalidateOnFocus: true,
    refreshInterval: 15000,
    onError: () => {},
  })

  const vehicles = data ?? fallbackVehicles

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles
    const q = searchQuery.toLowerCase()
    return vehicles.filter(
      (v) =>
        v.id.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q)
    )
  }, [vehicles, searchQuery])

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transport Resource Management</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor your entire fleet</p>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles by ID, type, or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{vehicle.id}</h3>
                <p className="text-sm text-muted-foreground">{vehicle.type}</p>
              </div>
              <Badge
                variant={
                  vehicle.status === 'active' ? 'default' : vehicle.status === 'idle' ? 'secondary' : 'outline'
                }
                className={
                  vehicle.status === 'active'
                    ? 'bg-primary text-primary-foreground'
                    : vehicle.status === 'idle'
                    ? 'bg-muted text-muted-foreground'
                    : ''
                }
              >
                {vehicle.status}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tonnage</span>
                <span className="font-medium">{vehicle.tonnage}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fuel Type</span>
                <div className="flex items-center gap-1">
                  {vehicle.fuel === 'electric' && <Battery className="w-4 h-4 text-primary" />}
                  {vehicle.fuel === 'combustion' && <Fuel className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-medium capitalize">{vehicle.fuel}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Emissions</span>
                <span className={`font-medium ${vehicle.emissions === '0 kg CO₂' ? 'text-primary' : ''}`}>
                  {vehicle.emissions}
                </span>
              </div>

              {vehicle.battery !== null && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Battery</span>
                    <span className="font-medium">{vehicle.battery}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${vehicle.battery}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-sm pt-2 border-t border-border">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{vehicle.location}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Button size="sm" variant="outline" className="flex-1">
                Assign
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                History
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
