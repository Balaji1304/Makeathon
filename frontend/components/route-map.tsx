'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RouteMapOrder } from '@/lib/api'

// Leaflet requires fixing the default icon paths when using Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/marker-icon-2x.png',
    iconUrl: '/marker-icon.png',
    shadowUrl: '/marker-shadow.png',
})

const COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
]

// Custom hook to automatically adjust map bounds to fit all drawn routes
function MapBoundsFit({ orders }: { orders: RouteMapOrder[] }) {
    const map = useMap()

    useEffect(() => {
        if (orders.length === 0) return

        const allLats: number[] = []
        const allLngs: number[] = []

        orders.forEach(o => {
            o.stops.forEach(s => {
                allLats.push(s.lat)
                allLngs.push(s.lon)
            })
        })

        if (allLats.length > 0) {
            const minLat = Math.min(...allLats)
            const maxLat = Math.max(...allLats)
            const minLng = Math.min(...allLngs)
            const maxLng = Math.max(...allLngs)

            map.fitBounds([
                [minLat, minLng],
                [maxLat, maxLng]
            ], { padding: [20, 20] })
        }
    }, [map, orders])

    return null
}

interface RouteMapProps {
    orders: RouteMapOrder[]
    height?: string
}

export default function RouteMap({ orders, height = "400px" }: RouteMapProps) {
    // Use Germany coordinates as fallback initial center if nothing is loaded
    const defaultCenter: [number, number] = [51.165691, 10.451526]

    return (
        <div style={{ height, width: "100%", borderRadius: "12px", overflow: "hidden" }}>
            <MapContainer
                center={defaultCenter}
                zoom={6}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {orders.map((order, index) => {
                    if (order.stops.length < 2) return null

                    const sortedStops = [...order.stops].sort((a, b) => a.sequence - b.sequence)
                    const positions: [number, number][] = sortedStops.map(s => [s.lat, s.lon])
                    const color = COLORS[index % COLORS.length]

                    return (
                        <div key={order.order_id}>
                            {/* Route Line */}
                            <Polyline
                                positions={positions}
                                pathOptions={{ color, weight: 4, opacity: 0.8 }}
                            />

                            {/* Start Node */}
                            <Marker position={positions[0]}>
                                <Popup>
                                    <strong>Order #{order.order_id}</strong><br />
                                    Origin (Sequence 1)<br />
                                    [{positions[0][0].toFixed(2)}, {positions[0][1].toFixed(2)}]
                                </Popup>
                            </Marker>

                            {/* Destination Node */}
                            <Marker position={positions[positions.length - 1]}>
                                <Popup>
                                    <strong>Order #{order.order_id}</strong><br />
                                    Destination<br />
                                    [{positions[positions.length - 1][0].toFixed(2)}, {positions[positions.length - 1][1].toFixed(2)}]
                                </Popup>
                            </Marker>
                        </div>
                    )
                })}

                <MapBoundsFit orders={orders} />
            </MapContainer>
        </div>
    )
}
