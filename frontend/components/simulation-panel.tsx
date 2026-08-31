'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Play, Sparkles, TrendingDown, TrendingUp, ArrowRight, Zap, BarChart3 } from 'lucide-react'
import { fetchSimulateOrder, type SimulationResponse } from '@/lib/api'
import useSWR from 'swr'
import api from '@/src/services/api'

interface SimulationPanelProps {
  selectedOrderId: number | null
  onOrderSelect?: (orderId: number) => void
}

export default function SimulationPanel({ selectedOrderId, onOrderSelect }: SimulationPanelProps) {
  const [targetVehicle, setTargetVehicle] = useState<string>('ZFT005')
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null)
  const [simError, setSimError] = useState<string | null>(null)

  const { data: orderData } = useSWR('orders-list', async () => {
    const { data } = await api.get('/orders')
    return data
  }, { revalidateOnFocus: false })

  const { data: vehicleTypes } = useSWR('vehicle-types', async () => {
    const { data } = await api.get('/fleet/vehicle-types')
    return data as Array<{ code: string; description: string; capacity_kg: number | null; fuel_type: string }>
  }, { revalidateOnFocus: false })

  const orders = (orderData || []).map((o: any) => ({
    id: o.order_id,
    label: `Order #${o.order_id}`,
    distance: o.distance_km,
    co2: o.total_co2_kg,
    load: o.avg_load_ratio,
  }))

  const currentOrder = orders.find((o: any) => o.id === selectedOrderId)

  const handleSimulate = async () => {
    if (!selectedOrderId) return
    setSimLoading(true)
    setSimError(null)
    setSimResult(null)

    try {
      const res = await fetchSimulateOrder(selectedOrderId, targetVehicle)
      if (res) {
        setSimResult(res)
      } else {
        setSimError('Simulation failed. Check if the order and vehicle type are valid.')
      }
    } catch (e) {
      setSimError('An error occurred during simulation.')
    }
    setSimLoading(false)
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            ML Prescriptive Simulator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test vehicle alternatives to project CO₂ savings and load efficiency using Machine Learning
          </p>
        </div>
        {selectedOrderId && (
          <Badge className="bg-primary text-primary-foreground">
            Order #{selectedOrderId} selected
          </Badge>
        )}
      </div>

      {!selectedOrderId ? (
        <div className="py-8 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Select an order from the table below to start simulating</p>
          <p className="text-xs mt-1">Or click "Details" on any order card</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Order Info */}
            <div className="p-4 rounded-xl border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Order</p>
              <div className="space-y-1">
                <p className="font-bold text-lg">#{currentOrder?.id || selectedOrderId}</p>
                <p className="text-sm text-muted-foreground">
                  Distance: <span className="font-medium text-foreground">{currentOrder?.distance?.toFixed(1) || '—'} km</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  CO₂: <span className="font-medium text-foreground">{currentOrder?.co2?.toFixed(1) || '—'} kg</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Load: <span className="font-medium text-foreground">{((currentOrder?.load || 0) * 100).toFixed(0)}%</span>
                </p>
              </div>
            </div>

            {/* Vehicle Selector */}
            <div className="p-4 rounded-xl border bg-card/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target Vehicle Type</p>
              <Select value={targetVehicle} onValueChange={setTargetVehicle}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes && vehicleTypes.length > 0 ? (
                    vehicleTypes.map((vt) => (
                      <SelectItem key={vt.code} value={vt.code}>
                        <div className="flex items-center gap-2">
                          {vt.fuel_type === 'electric' ? (
                            <Zap className="w-3 h-3 text-primary" />
                          ) : vt.fuel_type === 'truck' ? (
                            <div className="w-3 h-3 rounded bg-muted-foreground/60" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" />
                          )}
                          <span className="font-medium">{vt.code}</span>
                          <span className="text-xs text-muted-foreground">{vt.description}</span>
                          {vt.capacity_kg && (
                            <span className="text-[10px] text-muted-foreground/60">({vt.capacity_kg}kg)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="ZFT003">ZFT003 - Sprinter</SelectItem>
                      <SelectItem value="ZFT004">ZFT004 - LKW 7.5-18t</SelectItem>
                      <SelectItem value="ZFT005">ZFT005 - Elektro Sprinter</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSimulate}
                disabled={simLoading || !selectedOrderId}
                className="w-full mt-3 gap-2"
              >
                {simLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {simLoading ? 'Running ML Prediction...' : 'Run Simulation'}
              </Button>
            </div>
          </div>

          {/* Error State */}
          {simError && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
              {simError}
            </div>
          )}

          {/* Results */}
          {simResult && (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              {/* Recommendation */}
              <div className={`p-4 rounded-xl border ${simResult.savings_percentage > 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${simResult.savings_percentage > 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    {simResult.savings_percentage > 0 ? (
                      <TrendingDown className="w-5 h-5 text-primary" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{simResult.recommendation_text}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Switching order #{simResult.order_id} to {simResult.vehicle_type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Before */}
                <div className="p-4 rounded-xl border bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-bold">{currentOrder ? `Order #${currentOrder.id}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Predicted CO₂</p>
                      <p className="font-bold text-lg">{simResult.current_predicted_co2.toFixed(1)} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Load Ratio</p>
                      <p className="font-bold text-lg">{((currentOrder?.load || 0) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRight className="w-8 h-8 text-primary rotate-90 md:rotate-0" />
                    <Badge variant="outline" className="text-xs">
                      {simResult.savings_percentage > 0 ? 'Saves' : 'Increases'} {Math.abs(simResult.savings_percentage).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {/* After */}
                <div className={`p-4 rounded-xl border ${simResult.savings_percentage > 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Simulated ({simResult.vehicle_type} — {vehicleTypes?.find(v => v.code === simResult.vehicle_type)?.description || simResult.vehicle_type})
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Predicted CO₂</p>
                      <p className="font-bold text-lg">{simResult.predicted_co2.toFixed(1)} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Utilization Change</p>
                      <p className={`font-bold ${simResult.utilization_change > 0 ? 'text-primary' : simResult.utilization_change < 0 ? 'text-destructive' : ''}`}>
                        {simResult.utilization_change > 0 ? '+' : ''}{(simResult.utilization_change * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual bar comparison */}
              <div className="p-4 rounded-xl border bg-card/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">CO₂ Impact Visual</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Current Emissions</span>
                      <span className="font-medium">{simResult.current_predicted_co2.toFixed(1)} kg</span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/60 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Simulated Emissions</span>
                      <span className={`font-medium ${simResult.savings_percentage > 0 ? 'text-primary' : 'text-destructive'}`}>
                        {simResult.predicted_co2.toFixed(1)} kg
                      </span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${simResult.savings_percentage > 0 ? 'bg-primary' : 'bg-destructive'}`}
                        style={{
                          width: `${Math.min(100, (simResult.predicted_co2 / Math.max(simResult.current_predicted_co2, 0.001)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
