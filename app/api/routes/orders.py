import logging
from typing import List

from fastapi import APIRouter, HTTPException
from sqlalchemy import func

from app.api.deps import DbSession
from app.api.schemas import OrderDetail, OrderStop, OrderSummary
from app.database.models import (
    Address,
    FreightOrder,
    FreightOrderStop,
    TransportStageFact,
    Vehicle,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[OrderSummary])
def list_orders(db: DbSession) -> List[OrderSummary]:
    logger.info("GET /orders")

    rows = (
        db.query(
            TransportStageFact.order_id,
            FreightOrder.vehicle_id,
            Vehicle.license_plate,
            func.coalesce(func.sum(TransportStageFact.distance_km), 0.0),
            func.coalesce(func.sum(TransportStageFact.co2_kg), 0.0),
            func.coalesce(func.avg(TransportStageFact.load_ratio), 0.0),
        )
        .join(FreightOrder, FreightOrder.order_id == TransportStageFact.order_id)
        .join(Vehicle, Vehicle.vehicle_id == FreightOrder.vehicle_id)
        .group_by(
            TransportStageFact.order_id,
            FreightOrder.vehicle_id,
            Vehicle.license_plate,
        )
        .all()
    )

    return [
        OrderSummary(
            order_id=int(order_id),
            vehicle_id=int(vehicle_id) if vehicle_id is not None else None,
            license_plate=license_plate,
            distance_km=float(distance_km or 0.0),
            total_co2_kg=float(total_co2 or 0.0),
            avg_load_ratio=float(avg_load or 0.0),
        )
        for order_id, vehicle_id, license_plate, distance_km, total_co2, avg_load in rows
        if order_id is not None
    ]


@router.get("/{order_id}", response_model=OrderDetail)
def get_order(order_id: int, db: DbSession) -> OrderDetail:
    logger.info("GET /orders/%s", order_id)

    summary_row = (
        db.query(
            TransportStageFact.order_id,
            FreightOrder.vehicle_id,
            Vehicle.license_plate,
            func.coalesce(func.sum(TransportStageFact.distance_km), 0.0),
            func.coalesce(func.sum(TransportStageFact.co2_kg), 0.0),
            func.coalesce(func.avg(TransportStageFact.load_ratio), 0.0),
        )
        .join(FreightOrder, FreightOrder.order_id == TransportStageFact.order_id)
        .join(Vehicle, Vehicle.vehicle_id == FreightOrder.vehicle_id)
        .filter(TransportStageFact.order_id == order_id)
        .group_by(
            TransportStageFact.order_id,
            FreightOrder.vehicle_id,
            Vehicle.license_plate,
        )
        .first()
    )
    if summary_row is None:
        raise HTTPException(status_code=404, detail="Order not found")

    (
        _oid,
        vehicle_id,
        license_plate,
        distance_km,
        total_co2,
        avg_load,
    ) = summary_row

    stop_rows = (
        db.query(
            FreightOrderStop.sequence_number,
            FreightOrderStop.address_id,
            Address.latitude,
            Address.longitude,
            Address.city,
            Address.country,
        )
        .join(Address, Address.address_id == FreightOrderStop.address_id)
        .filter(FreightOrderStop.order_id == order_id)
        .order_by(FreightOrderStop.sequence_number)
        .all()
    )

    stops = [
        OrderStop(
            sequence_number=int(seq),
            address_id=int(address_id),
            latitude=float(lat) if lat is not None else None,
            longitude=float(lon) if lon is not None else None,
            city=city,
            country=country,
        )
        for seq, address_id, lat, lon, city, country in stop_rows
    ]

    return OrderDetail(
        order_id=order_id,
        vehicle_id=int(vehicle_id) if vehicle_id is not None else None,
        license_plate=license_plate,
        distance_km=float(distance_km or 0.0),
        total_co2_kg=float(total_co2 or 0.0),
        avg_load_ratio=float(avg_load or 0.0),
        stops=stops,
    )

