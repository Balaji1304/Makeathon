// ─── Types ───────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string
  type: string
  tonnage: string
  fuel: "electric" | "combustion" | "hybrid"
  emissions: string
  status: "active" | "idle" | "maintenance"
  location: string
  battery: number | null
}

export interface KPI {
  label: string
  value: string
  change: string
  trend: "up" | "down"
}

export interface FleetOverview {
  type: string
  count: number
  active: number
  utilization: number
}

export interface QuickStats {
  totalVehicles: number
  activeRoutes: number
  pendingOrders: number
  ecoScore: string
}

export interface DashboardData {
  kpis: KPI[]
  fleetOverview: FleetOverview[]
  quickStats: QuickStats
}

export interface Order {
  id: string
  origin: string
  destination: string
  weight: string
  priority: "high" | "medium" | "low"
  emissions: string
  status: "assigned" | "pending" | "completed"
  route: string | null
}

export interface Scenario {
  name: string
  duration: string
  emissions: string
  cost: string
  efficiency: number
  recommended?: boolean
}

export interface OrdersData {
  orders: Order[]
  scenarios: Scenario[]
}

export interface Alert {
  id: number
  type: "optimization" | "sustainability" | "warning" | "info"
  title: string
  message: string
  time: string
  priority: "high" | "medium" | "low"
}

export interface AlertsSummary {
  highPriority: number
  sustainability: number
  optimizations: number
}

export interface AlertsData {
  alerts: Alert[]
  summary: AlertsSummary
}

export interface DriverProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  department: string
  accessLevel: string
}

export interface EmissionsData {
  totalEmissions: string
  emissionsChange: string
  dailyTarget: string
  currentStatus: string
}

// ─── API Client ──────────────────────────────────────────────────────────────

import api from "../src/services/api";

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardData> {
  const [summaryRes, fleetRes] = await Promise.all([
    api.get("/dashboard/summary"),
    api.get("/fleet/overview")
  ]);
  const s = summaryRes.data;
  const f = fleetRes.data;

  return {
    kpis: [
      { label: 'CO₂ Emissions', value: `${s.total_co2_emission.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`, change: 'live', trend: 'down' },
      { label: 'Distance Traveled', value: `${s.total_distance_km.toLocaleString('en-US', { maximumFractionDigits: 0 })} km`, change: 'live', trend: 'up' },
      { label: 'Orders Fulfilled', value: `${s.number_of_orders}`, change: 'live', trend: 'up' },
      { label: 'Cost Savings', value: `~${s.estimated_co2_savings.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg CO₂`, change: 'live', trend: 'down' },
    ],
    fleetOverview: f.vehicle_counts_by_type.map((vt: any) => ({
      type: vt.transport_type,
      count: vt.vehicle_count,
      active: vt.vehicle_count, // Fallback
      utilization: Math.round(vt.avg_load_ratio * 100)
    })),
    quickStats: {
      totalVehicles: f.total_vehicles,
      activeRoutes: s.number_of_orders,
      pendingOrders: 0,
      ecoScore: f.average_utilization > 0.6 ? 'Good' : 'Needs Improvement'
    }
  };
}

// ─── Fleet / Vehicles ────────────────────────────────────────────────────────

export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    const res = await api.get("/fleet/overview");
    const vts = res.data.vehicle_counts_by_type;
    const vehicles: Vehicle[] = [];
    vts.forEach((vt: any, idx: number) => {
      // Create mock vehicles for each stats to satisfy the UI requirement
      for (let i = 0; i < vt.vehicle_count; i++) {
        vehicles.push({
          id: `VH-${vt.transport_type.slice(0, 3).toUpperCase()}-${idx}-${i + 1}`,
          type: vt.transport_type,
          tonnage: "N/A",
          fuel: vt.transport_type.toLowerCase().includes('electric') ? 'electric' : 'combustion',
          emissions: `${(vt.emission_intensity_kg_per_km * 100).toFixed(1)} kg CO₂`,
          status: 'active',
          location: 'En route',
          battery: vt.transport_type.toLowerCase().includes('electric') ? 80 : null
        });
      }
    });
    return vehicles;
  } catch (err) {
    return [];
  }
}

export async function fetchVehicleById(id: string): Promise<Vehicle> {
  const vehicles = await fetchVehicles();
  return vehicles.find(v => v.id === id) as Vehicle;
}

// ─── Orders & Routes ─────────────────────────────────────────────────────────

export async function fetchOrdersData(): Promise<OrdersData> {
  const { data } = await api.get("/orders");
  return {
    orders: data.map((o: any) => ({
      id: `ORD-${o.order_id}`,
      origin: "Source Location",
      destination: "Destination Hub",
      weight: `${Math.round(o.avg_load_ratio * 1000)} kg`,
      priority: o.total_co2_kg > 100 ? "high" : "medium",
      emissions: `${Math.round(o.total_co2_kg ?? 0)} kg CO₂`,
      status: "assigned",
      route: o.license_plate ? `Vehicle ${o.license_plate}` : `Vehicle ${o.vehicle_id}`
    })),
    scenarios: [
      { name: 'Standard Routing', duration: 'Based on history', emissions: 'Current avg', cost: 'Standard', efficiency: 70 },
      { name: 'ML Optimized Routing', duration: 'Predicted', emissions: 'Reduced', cost: 'Optimized', efficiency: 90, recommended: true }
    ]
  };
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export async function fetchAlertsData(): Promise<AlertsData> {
  const { data } = await api.get("/alerts/recommendations");
  const mappedAlerts: Alert[] = data.map((r: any, idx: number) => ({
    id: idx + 1,
    type: r.alert_type === "optimization" ? "optimization" : "sustainability",
    title: r.alert_type === "optimization" ? `Optimize Order ${r.order_id}` : `Alert: Order ${r.order_id}`,
    message: r.explanation,
    time: "Just now",
    priority: r.priority_score > 0.8 ? "high" : (r.priority_score > 0.5 ? "medium" : "low")
  }));

  return {
    alerts: mappedAlerts,
    summary: {
      highPriority: mappedAlerts.filter(a => a.priority === "high").length,
      sustainability: mappedAlerts.filter(a => a.type === "sustainability").length,
      optimizations: mappedAlerts.filter(a => a.type === "optimization").length
    }
  };
}

// ─── Profile / Driver ────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<DriverProfile> {
  return {
    firstName: "Demo", lastName: "User", email: "demo@greentrack.com", phone: "+1 234 567 890", role: "Dispatcher", department: "Operations", accessLevel: "Admin"
  };
}

export async function updateProfile(data: Partial<DriverProfile>): Promise<DriverProfile> {
  return await fetchProfile();
}

// ─── Emissions / Sustainability ──────────────────────────────────────────────

export async function fetchEmissionsData(): Promise<EmissionsData> {
  return { totalEmissions: "0 kg", emissionsChange: "0%", dailyTarget: "0 kg", currentStatus: "Normal" };
}
