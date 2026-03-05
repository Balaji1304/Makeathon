'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { MapPin, Truck, Leaf, Route, Loader2, Play, Sparkles } from 'lucide-react'
import { fetchOrderDetails, fetchSimulateOrder, type OrderDetail, type SimulationResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface OrderDetailsModalProps {
    orderId: string | null
    isOpen: boolean
    onClose: () => void
}

export function OrderDetailsModal({ orderId, isOpen, onClose }: OrderDetailsModalProps) {
    const [data, setData] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(false)

    // Simulator State
    const [selectedVehicle, setSelectedVehicle] = useState<string>("ZFT005")
    const [simLoading, setSimLoading] = useState(false)
    const [simResult, setSimResult] = useState<SimulationResponse | null>(null)

    useEffect(() => {
        if (isOpen && orderId) {
            setLoading(true)
            // Extract numeric ID from "ORD-123"
            const numericId = orderId.replace('ORD-', '')
            fetchOrderDetails(numericId).then((res) => {
                setData(res)
                setLoading(false)
                setSimResult(null) // Reset sim on new order load
            })
        } else {
            setData(null)
            setSimResult(null)
        }
    }, [isOpen, orderId])

    const handleSimulate = async () => {
        if (!data) return
        setSimLoading(true)
        const res = await fetchSimulateOrder(data.order_id, selectedVehicle)
        setSimResult(res)
        setSimLoading(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] !p-0 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 pb-2 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            Order <span className="text-primary">{orderId}</span> Details
                        </DialogTitle>
                        <DialogDescription>
                            Deep dive into environmental metrics, assigned vehicles, and geographic routing.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 pt-0 overflow-y-auto flex-1 min-h-0 custom-scrollbar">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground w-full">
                            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                            <p className="text-sm font-medium">Fetching exact metrics from fleet database...</p>
                        </div>
                    ) : data ? (
                        <div className="space-y-6 mt-4">

                            {/* KPI Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-card/50 flex flex-col items-start gap-1 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Leaf className="w-4 h-4 text-primary" />
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Emissions</p>
                                    </div>
                                    <p className="text-2xl font-bold">{data.total_co2_kg.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg CO₂</span></p>
                                </div>

                                <div className="p-4 rounded-xl border bg-card/50 flex flex-col items-start gap-1 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Route className="w-4 h-4 text-chart-2" />
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Route</p>
                                    </div>
                                    <p className="text-2xl font-bold">{data.distance_km.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">km</span></p>
                                </div>

                                <div className="p-4 rounded-xl border bg-card/50 flex flex-col items-start gap-1 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Truck className="w-4 h-4 text-accent" />
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mean Load Ratio</p>
                                    </div>
                                    <p className="text-2xl font-bold">{(data.avg_load_ratio * 100).toFixed(1)}<span className="text-sm font-normal text-muted-foreground">%</span></p>
                                </div>

                                <div className="p-4 rounded-xl border bg-primary/5 flex flex-col items-start gap-1 shadow-sm h-full justify-center">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assigned Vehicle</p>
                                    {data.license_plate ? (
                                        <p className="text-xl font-bold text-primary">{data.license_plate}</p>
                                    ) : (
                                        <p className="text-xl font-bold text-muted-foreground/60 italic">Unassigned</p>
                                    )}
                                </div>
                            </div>

                            {/* Geographic Stops */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-muted-foreground" />
                                    Physical Stops
                                </h3>

                                <div className="space-y-3">
                                    {data.stops.map((stop, index) => (
                                        <div key={index} className="flex gap-4 p-3 rounded-xl border bg-muted/30 items-center hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold shadow-sm shrink-0">
                                                {stop.sequence_number}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-foreground text-[15px] truncate">
                                                    {stop.city && stop.city !== 'nan' ? `${stop.city}, ` : ''}
                                                    {stop.country && stop.country !== 'nan' ? stop.country : 'Unknown Geolocation'}
                                                </div>
                                                {(stop.latitude !== null && stop.longitude !== null) && (
                                                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-mono tracking-wider bg-card px-2 py-0.5 rounded-md w-fit border shadow-sm">
                                                        L: {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                    ) : (
                        <div className="py-12 text-center text-muted-foreground">
                            No route breakdown available for {orderId}.
                        </div>
                    )}

                    {/* Prescriptive Analytics Simulator */}
                    {data && (
                        <div className="mt-8 pt-6 border-t">
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent" />
                                AI Prescriptive Simulator
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Test alternative vehicle assignments to project emissions savings and load efficiency using Machine Learning.
                            </p>

                            <div className="flex gap-3 mb-4">
                                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select alternative vehicle type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ZFT005">Light Commercial (Electric)</SelectItem>
                                        <SelectItem value="ZFT003">Sprinter (Combustion)</SelectItem>
                                        <SelectItem value="ZFT002">7.5t Truck (Combustion)</SelectItem>
                                        <SelectItem value="ZFT004">18t Truck (Combustion)</SelectItem>
                                        <SelectItem value="ZFT006">VW Transporter (Electric)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleSimulate} disabled={simLoading} className="gap-2 shrink-0">
                                    {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    Simulate
                                </Button>
                            </div>

                            {simResult && (
                                <div className={`p-4 rounded-xl border ${simResult.savings_percentage > 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'} animate-in fade-in zoom-in duration-300`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-semibold">{simResult.recommendation_text}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <div className="text-xs text-muted-foreground uppercase">Projected CO₂ Savings</div>
                                            <div className={`text-xl font-bold ${simResult.savings_percentage > 0 ? 'text-primary' : 'text-destructive'}`}>
                                                {simResult.savings_percentage > 0 ? '+' : ''}{simResult.savings_percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground uppercase">Utilization Shift</div>
                                            <div className={`text-xl font-bold ${simResult.utilization_change > 0 ? 'text-primary' : (simResult.utilization_change < 0 ? 'text-destructive' : 'text-muted-foreground')}`}>
                                                {simResult.utilization_change > 0 ? '+' : ''}{(simResult.utilization_change * 100).toFixed(1)}% Fill
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    )
}
