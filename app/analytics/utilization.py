import logging
from dataclasses import dataclass
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import TransportStageFact, Vehicle, TransportType

logger = logging.getLogger(__name__)


@dataclass
class UnderutilizedVehicle:
    vehicle_id: int
    avg_load_ratio: float
    total_distance_km: float


@dataclass
class HighEmissionRoute:
    order_id: int
    total_co2: float
    total_distance_km: float


@dataclass
class UnusedElectricCapacity:
    vehicle_id: int
    transport_type: str
    avg_load_ratio: float
    total_distance_km: float


def find_underutilized_vehicles(
    session: Session, threshold: float = 0.5
) -> List[UnderutilizedVehicle]:
    rows = (
        session.query(
            TransportStageFact.vehicle_id,
            func.avg(TransportStageFact.load_ratio),
            func.sum(TransportStageFact.distance_km),
        )
        .group_by(TransportStageFact.vehicle_id)
        .having(func.avg(TransportStageFact.load_ratio) < threshold)
        .all()
    )

    result = [
        UnderutilizedVehicle(
            vehicle_id=int(vid),
            avg_load_ratio=float(avg or 0.0),
            total_distance_km=float(dist or 0.0),
        )
        for vid, avg, dist in rows
        if vid is not None
    ]
    logger.info("Found %d underutilized vehicles", len(result))
    return result


def high_emission_routes(session: Session, top_n: int = 5) -> List[HighEmissionRoute]:
    rows = (
        session.query(
            TransportStageFact.order_id,
            func.sum(TransportStageFact.co2_kg),
            func.sum(TransportStageFact.distance_km),
        )
        .group_by(TransportStageFact.order_id)
        .order_by(func.sum(TransportStageFact.co2_kg).desc())
        .limit(top_n)
        .all()
    )
    result = [
        HighEmissionRoute(
            order_id=int(oid),
            total_co2=float(co2 or 0.0),
            total_distance_km=float(dist or 0.0),
        )
        for oid, co2, dist in rows
        if oid is not None
    ]
    logger.info("Identified %d high emission routes", len(result))
    return result


def unused_electric_capacity(session: Session) -> List[UnusedElectricCapacity]:
    """
    Find electric vehicles whose average load ratio is low.
    Electric detection is heuristic: transport type name ILIKE '%elektro%' or '%electric%'.
    """
    q = (
        session.query(
            TransportStageFact.vehicle_id,
            func.avg(TransportStageFact.load_ratio),
            func.sum(TransportStageFact.distance_km),
            TransportType.name,
        )
        .join(Vehicle, TransportStageFact.vehicle_id == Vehicle.vehicle_id)
        .join(
            TransportType,
            Vehicle.transport_type_id == TransportType.transport_type_id,
        )
        .filter(
            func.lower(TransportType.name).like("%elektro%")
            | func.lower(TransportType.name).like("%electric%")
        )
        .group_by(TransportStageFact.vehicle_id, TransportType.name)
    )

    rows = q.all()
    result = [
        UnusedElectricCapacity(
            vehicle_id=int(vid),
            transport_type=tt_name,
            avg_load_ratio=float(avg or 0.0),
            total_distance_km=float(dist or 0.0),
        )
        for vid, avg, dist, tt_name in rows
        if vid is not None
    ]
    logger.info("Found %d electric vehicles with tracked utilization", len(result))
    return result

