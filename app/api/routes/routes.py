import logging
from typing import List

from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.schemas import RouteMapOrder, RouteStop
from sqlalchemy import func
from app.database.models import Address, FreightOrderStop, TransportStageFact

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/map", response_model=List[RouteMapOrder])
def get_route_map(db: DbSession) -> List[RouteMapOrder]:
    logger.info("GET /routes/map")

    # Fetch all stops
    stop_rows = (
        db.query(
            FreightOrderStop.order_id,
            FreightOrderStop.sequence_number,
            Address.latitude,
            Address.longitude,
        )
        .join(Address, Address.address_id == FreightOrderStop.address_id)
        .order_by(FreightOrderStop.order_id, FreightOrderStop.sequence_number)
        .all()
    )

    # Fetch aggregated Load Ratios from ML/Fact tables
    ratio_rows = (
        db.query(
            TransportStageFact.order_id,
            func.avg(TransportStageFact.load_ratio).label("avg_ratio")
        )
        .group_by(TransportStageFact.order_id)
        .all()
    )
    load_ratios = {row.order_id: float(row.avg_ratio or 0.0) for row in ratio_rows}

    orders: dict[int, list[RouteStop]] = {}
    for order_id, seq, lat, lon in stop_rows:
        if order_id is None or lat is None or lon is None:
            continue
        stops = orders.setdefault(int(order_id), [])
        stops.append(
            RouteStop(sequence=int(seq), lat=float(lat), lon=float(lon)),
        )

    return [
        RouteMapOrder(
            order_id=oid, 
            avg_load_ratio=load_ratios.get(oid, 0.0), 
            stops=stops
        ) for oid, stops in orders.items()
    ]

