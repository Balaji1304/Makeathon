import logging
from typing import List

from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.schemas import RouteMapOrder, RouteStop
from app.database.models import Address, FreightOrderStop

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/map", response_model=List[RouteMapOrder])
def get_route_map(db: DbSession) -> List[RouteMapOrder]:
    logger.info("GET /routes/map")

    rows = (
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

    orders: dict[int, list[RouteStop]] = {}
    for order_id, seq, lat, lon in rows:
        if order_id is None or lat is None or lon is None:
            continue
        stops = orders.setdefault(int(order_id), [])
        stops.append(
            RouteStop(sequence=int(seq), lat=float(lat), lon=float(lon)),
        )

    return [
        RouteMapOrder(order_id=oid, stops=stops) for oid, stops in orders.items()
    ]

