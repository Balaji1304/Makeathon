'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RouteMapOrder } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { MapPin, Truck, Package } from 'lucide-react'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/marker-icon-2x.png',
    iconUrl: '/marker-icon.png',
    shadowUrl: '/marker-shadow.png',
})

const ROUTE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const DEPOT_ICON = L.divIcon({
    className: 'custom-depot-icon',
    html: `<div style="background:#10b981;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
})

function MapBoundsFit({ orders }: { orders: RouteMapOrder[] }) {
    const map = useMap()
    useEffect(() => {
        if (orders.length === 0) return
        const allLats: number[] = []
        const allLngs: number[] = []
        orders.forEach(o => o.stops.forEach(s => { allLats.push(s.lat); allLngs.push(s.lon) }))
        if (allLats.length > 0) {
            map.fitBounds([
                [Math.min(...allLats), Math.min(...allLngs)],
                [Math.max(...allLats), Math.max(...allLngs)]
            ], { padding: [30, 30] })
        }
    }, [map, orders])
    return null
}

function RouteTooltip({ order, index }: { order: RouteMapOrder; index: number }) {
    const ratio = order.avg_load_ratio || 0
    const efficiency = ratio >= 0.70 ? 'Optimal' : ratio >= 0.35 ? 'Moderate' : 'Empty Miles'
    const efficiencyColor = ratio >= 0.70 ? '#10b981' : ratio >= 0.35 ? '#f59e0b' : '#ef4444'
    return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-2 shadow-lg text-xs min-w-[140px]">
            <div className="font-semibold text-foreground">Order #{order.order_id}</div>
            <div className="text-muted-foreground mt-1">{order.stops.length} stops</div>
            <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full" style={{ background: efficiencyColor }} />
                <span>{efficiency} ({(ratio * 100).toFixed(0)}%)</span>
            </div>
        </div>
    )
}

interface RouteMapProps {
    orders: RouteMapOrder[]
    height?: string
    selectedOrderId?: number | null
    onOrderSelect?: (orderId: number) => void
}

export default function RouteMap({ orders, height = "400px", selectedOrderId, onOrderSelect }: RouteMapProps) {
    const [hoveredOrder, setHoveredOrder] = useState<number | null>(null)
    const defaultCenter: [number, number] = [51.165691, 10.451526]

    const visibleOrders = useMemo(() => {
        if (selectedOrderId) return orders.filter(o => o.order_id === selectedOrderId)
        return orders
    }, [orders, selectedOrderId])

    return (
        <div style={{ height, width: "100%", borderRadius: "12px", overflow: "hidden", position: 'relative' }}>
            <MapContainer
                center={defaultCenter}
                zoom={6}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {visibleOrders.map((order, idx) => {
                    if (order.stops.length < 2) return null
                    const sortedStops = [...order.stops].sort((a, b) => a.sequence - b.sequence)
                    const positions: [number, number][] = sortedStops.map(s => [s.lat, s.lon])
                    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]
                    const ratio = order.avg_load_ratio || 0
                    const isHovered = hoveredOrder === order.order_id
                    const isSelected = selectedOrderId === order.order_id

                    return (
                        <div key={order.order_id}>
                            {/* Route line with weight based on selection/hover */}
                            <Polyline
                                positions={positions}
                                pathOptions={{
                                    color,
                                    weight: isSelected ? 6 : isHovered ? 5 : 3,
                                    opacity: isSelected ? 1 : isHovered ? 0.9 : 0.7,
                                    dashArray: ratio < 0.35 ? '8 8' : undefined,
                                }}
                                eventHandlers={{
                                    mouseover: () => setHoveredOrder(order.order_id),
                                    mouseout: () => setHoveredOrder(null),
                                    click: () => onOrderSelect?.(order.order_id),
                                }}
                            />

                            {/* All stops as numbered circle markers */}
                            {sortedStops.map((stop, stopIdx) => {
                                const isFirst = stopIdx === 0
                                const isLast = stopIdx === sortedStops.length - 1
                                const markerRadius = isFirst || isLast ? 8 : 5

                                return (
                                    <CircleMarker
                                        key={`${order.order_id}-${stop.sequence}`}
                                        center={[stop.lat, stop.lon]}
                                        radius={markerRadius}
                                        pathOptions={{
                                            color: isFirst ? '#10b981' : isLast ? '#ef4444' : color,
                                            fillColor: isFirst ? '#10b981' : isLast ? '#ef4444' : color,
                                            fillOpacity: 0.9,
                                            weight: 2,
                                        }}
                                        eventHandlers={{
                                            mouseover: () => setHoveredOrder(order.order_id),
                                            mouseout: () => setHoveredOrder(null),
                                        }}
                                    >
                                        <Tooltip
                                            direction="top"
                                            offset={[0, -8]}
                                            opacity={1}
                                            permanent={isFirst || isLast}
                                        >
                                            <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
                                                {isFirst ? `O${order.order_id}` : isLast ? `D${order.order_id}` : stop.sequence}
                                            </span>
                                        </Tooltip>
                                        <Popup>
                                            <div style={{ minWidth: '150px', fontFamily: 'system-ui' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
                                                    {isFirst ? '📦 Origin' : isLast ? '🏁 Destination' : `Stop #${stop.sequence}`}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>
                                                    Order #{order.order_id}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                                    {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}
                                                </div>
                                                <div style={{ fontSize: '11px', marginTop: '4px', padding: '2px 6px', background: ratio >= 0.70 ? '#d1fae5' : ratio >= 0.35 ? '#fef3c7' : '#fee2e2', borderRadius: '4px', display: 'inline-block' }}>
                                                    {(ratio * 100).toFixed(0)}% utilization
                                                </div>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                )
                            })}

                            {/* Start marker with custom icon for depot */}
                            <Marker
                                position={positions[0]}
                                icon={DEPOT_ICON}
                                eventHandlers={{
                                    mouseover: () => setHoveredOrder(order.order_id),
                                    mouseout: () => setHoveredOrder(null),
                                    click: () => onOrderSelect?.(order.order_id),
                                }}
                            />
                        </div>
                    )
                })}

                <MapBoundsFit orders={visibleOrders} />
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-[400] bg-background/95 backdrop-blur border shadow-sm p-3 rounded-lg text-xs font-medium space-y-2">
                <div className="font-semibold text-muted-foreground mb-1">Route Legend</div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-[#10b981] rounded-full"></div>
                    <span>Origin Depot</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-[#ef4444] rounded-full"></div>
                    <span>Final Destination</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-gray-400 rounded-full" style={{ borderTop: '2px dashed #888' }}></div>
                    <span>Low Utilization</span>
                </div>
                <div className="border-t pt-2 mt-2">
                    <div className="font-semibold text-muted-foreground mb-1">Utilization</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div> Optimal (&ge;70%)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div> Moderate</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> Empty Miles (&lt;35%)</div>
                </div>
            </div>

            {/* Route count badge */}
            <div className="absolute top-4 left-4 z-[400] bg-background/95 backdrop-blur border shadow-sm px-3 py-1.5 rounded-lg text-xs font-medium">
                <span className="text-muted-foreground">Showing </span>
                <span className="font-bold text-foreground">{visibleOrders.length}</span>
                <span className="text-muted-foreground"> of {orders.length} routes</span>
            </div>
        </div>
    )
}
