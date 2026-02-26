import logging
from dataclasses import dataclass
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import TransportStageFact

logger = logging.getLogger(__name__)


def compute_stage_cost(distance_km: float, duration_min: float) -> float:
    return (
        distance_km * settings.cost_per_km
        + duration_min * settings.driver_cost_per_min
    )


@dataclass
class RouteCost:
    order_id: int
    total_distance_km: float
    total_duration_min: float
    total_co2_kg: float
    total_cost: float


def compute_route_costs(session: Session) -> List[RouteCost]:
    rows = (
        session.query(
            TransportStageFact.order_id,
            func.sum(TransportStageFact.distance_km),
            func.sum(TransportStageFact.duration_min),
            func.sum(TransportStageFact.co2_kg),
        )
        .group_by(TransportStageFact.order_id)
        .all()
    )
    result: List[RouteCost] = []
    for oid, dist, dur, co2 in rows:
        if oid is None:
            continue
        distance_km = float(dist or 0.0)
        duration_min = float(dur or 0.0)
        total_cost = compute_stage_cost(distance_km, duration_min)
        result.append(
            RouteCost(
                order_id=int(oid),
                total_distance_km=distance_km,
                total_duration_min=duration_min,
                total_co2_kg=float(co2 or 0.0),
                total_cost=total_cost,
            )
        )
    logger.info("Computed costs for %d routes", len(result))
    return result

