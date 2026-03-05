'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { MapPin, Truck, Leaf, Route, Loader2 } from 'lucide-react'
import { fetchOrderDetails, type OrderDetail } from '@/lib/api'

interface OrderDetailsModalProps {
    orderId: string | null
    isOpen: boolean
    onClose: () => void
}

export function OrderDetailsModal({ orderId, isOpen, onClose }: OrderDetailsModalProps) {
    const [data, setData] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && orderId) {
            setLoading(true)
            // Extract numeric ID from "ORD-123"
            const numericId = orderId.replace('ORD-', '')
            fetchOrderDetails(numericId).then((res) => {
                setData(res)
                setLoading(false)
            })
        } else {
            setData(null)
        }
    }, [isOpen, orderId])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] !p-6">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        Order <span className="text-primary">{orderId}</span> Details
                    </DialogTitle>
                    <DialogDescription>
                        Deep dive into environmental metrics, assigned vehicles, and geographic routing.
                    </DialogDescription>
                </DialogHeader>

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
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground text-[15px]">
                                                {stop.city ? `${stop.city}, ` : ''}{stop.country || 'Unknown Geolocation'}
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
            </DialogContent>
        </Dialog>
    )
}
