import logging

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import distinct, func

from app.api.deps import DbSession
from app.api.schemas import FleetOverview, FleetTypeStats
from app.database.models import TransportStageFact, TransportType, Vehicle, VehicleAttributes

router = APIRouter()
logger = logging.getLogger(__name__)


class VehicleTypeInfo(BaseModel):
    code: str
    description: str
    capacity_kg: float | None
    fuel_type: str


@router.get("/vehicle-types", response_model=list[VehicleTypeInfo])
def list_vehicle_types(db: DbSession) -> list[VehicleTypeInfo]:
    logger.info("GET /fleet/vehicle-types")

    rows = (
        db.query(
            TransportType.name,
            TransportType.description,
            VehicleAttributes.capacity_kg,
        )
        .outerjoin(VehicleAttributes, TransportType.transport_type_id == VehicleAttributes.transport_type_id)
        .order_by(TransportType.name)
        .all()
    )

    result = []
    for name, desc, cap in rows:
        desc_lower = (desc or "").lower()
        name_lower = (name or "").lower()
        if "elektro" in desc_lower or "electric" in desc_lower or "elektro" in name_lower:
            fuel = "electric"
        elif "lkw" in desc_lower or "truck" in desc_lower:
            fuel = "truck"
        else:
            fuel = "van"
        result.append(VehicleTypeInfo(
            code=name or "",
            description=desc or name or "",
            capacity_kg=float(cap) if cap else None,
            fuel_type=fuel,
        ))
    return result


@router.get("/overview", response_model=FleetOverview)
def get_fleet_overview(db: DbSession) -> FleetOverview:
    logger.info("GET /fleet/overview")

    # Per‑type stats: all heavy work in SQL.
    rows = (
        db.query(
            TransportType.name.label("transport_type"),
            func.count(distinct(Vehicle.vehicle_id)).label("vehicle_count"),
            func.coalesce(func.avg(TransportStageFact.load_ratio), 0.0).label(
                "avg_load"
            ),
            func.coalesce(func.sum(TransportStageFact.co2_kg), 0.0).label(
                "total_co2"
            ),
            func.coalesce(func.sum(TransportStageFact.distance_km), 0.0).label(
                "total_distance"
            ),
        )
        .select_from(Vehicle)
        .join(TransportType, Vehicle.transport_type_id == TransportType.transport_type_id)
        .outerjoin(TransportStageFact, TransportStageFact.vehicle_id == Vehicle.vehicle_id)
        .group_by(TransportType.name)
        .all()
    )

    type_stats: list[FleetTypeStats] = []
    total_vehicles = 0
    for name, count, avg_load, total_co2, total_dist in rows:
        vehicle_count = int(count or 0)
        total_vehicles += vehicle_count
        if total_dist:
            intensity = float(total_co2 or 0.0) / float(total_dist)
        else:
            intensity = 0.0
        type_stats.append(
            FleetTypeStats(
                transport_type=name,
                vehicle_count=vehicle_count,
                avg_load_ratio=float(avg_load or 0.0),
                emission_intensity_kg_per_km=float(intensity),
            )
        )

    # Electric vs combustion heuristic reused from analytics.
    electric_vehicles = int(
        db.query(func.count(distinct(Vehicle.vehicle_id)))
        .join(TransportType, Vehicle.transport_type_id == TransportType.transport_type_id)
        .filter(
            func.lower(TransportType.name).like("%elektro%")
            | func.lower(TransportType.name).like("%electric%")
        )
        .scalar()
        or 0
    )
    combustion_vehicles = max(total_vehicles - electric_vehicles, 0)

    avg_utilization = float(
        db.query(func.coalesce(func.avg(TransportStageFact.load_ratio), 0.0))
        .select_from(TransportStageFact)
        .scalar()
        or 0.0
    )

    return FleetOverview(
        total_vehicles=total_vehicles,
        vehicle_counts_by_type=type_stats,
        electric_vehicles=electric_vehicles,
        combustion_vehicles=combustion_vehicles,
        average_utilization=avg_utilization,
    )

