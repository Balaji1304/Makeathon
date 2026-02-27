from typing import List, Optional

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_co2_emission: float
    total_distance_km: float
    average_load_ratio: float
    number_of_orders: int
    estimated_co2_savings: float


class FleetTypeStats(BaseModel):
    transport_type: str
    vehicle_count: int
    avg_load_ratio: float
    emission_intensity_kg_per_km: float


class FleetOverview(BaseModel):
    total_vehicles: int
    vehicle_counts_by_type: List[FleetTypeStats]
    electric_vehicles: int
    combustion_vehicles: int
    average_utilization: float


class OrderSummary(BaseModel):
    order_id: int
    vehicle_id: Optional[int]
    license_plate: Optional[str]
    distance_km: float
    total_co2_kg: float
    avg_load_ratio: float


class OrderStop(BaseModel):
    sequence_number: int
    address_id: int
    latitude: Optional[float]
    longitude: Optional[float]
    city: Optional[str]
    country: Optional[str]


class OrderDetail(OrderSummary):
    stops: List[OrderStop]


class RouteStop(BaseModel):
    sequence: int
    lat: float
    lon: float


class RouteMapOrder(BaseModel):
    order_id: int
    stops: List[RouteStop]


class AlertRecommendation(BaseModel):
    order_id: int
    alert_type: str
    explanation: str
    estimated_co2_reduction: float
    priority_score: float


class SimulationRequest(BaseModel):
    order_id: int
    vehicle_type: str


class SimulationResponse(BaseModel):
    order_id: int
    vehicle_type: str
    predicted_co2: float
    savings_percentage: float
    utilization_change: float
    recommendation_text: str

