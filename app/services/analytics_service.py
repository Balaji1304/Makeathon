import logging
from typing import Any, Dict, Optional

import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import TransportStageFact, Vehicle, FreightOrder

logger = logging.getLogger(__name__)


def get_stage_facts(
    session: Session,
    vehicle_id: Optional[int] = None,
    order_id: Optional[int] = None,
) -> pd.DataFrame:
    query = session.query(TransportStageFact)
    if vehicle_id is not None:
        query = query.filter(TransportStageFact.vehicle_id == vehicle_id)
    if order_id is not None:
        query = query.filter(TransportStageFact.order_id == order_id)
    rows = query.all()
    if not rows:
        return pd.DataFrame()
    data = [
        {
            "order_id": r.order_id,
            "vehicle_id": r.vehicle_id,
            "transport_type": r.transport_type,
            "from_stop_id": r.from_stop_id,
            "to_stop_id": r.to_stop_id,
            "distance_km": float(r.distance_km or 0.0),
            "duration_min": float(r.duration_min or 0.0),
            "total_weight_kg": float(r.total_weight_kg or 0.0),
            "vehicle_capacity_kg": float(r.vehicle_capacity_kg or 0.0),
            "load_ratio": float(r.load_ratio or 0.0),
            "co2_kg": float(r.co2_kg or 0.0),
        }
        for r in rows
    ]
    df = pd.DataFrame(data)
    logger.info("Loaded %d stage fact rows into DataFrame", len(df))
    return df


def get_vehicle_summary(session: Session) -> pd.DataFrame:
    rows = (
        session.query(
            TransportStageFact.vehicle_id,
            func.sum(TransportStageFact.distance_km),
            func.sum(TransportStageFact.total_weight_kg),
            func.sum(TransportStageFact.vehicle_capacity_kg),
            func.avg(TransportStageFact.load_ratio),
            func.sum(TransportStageFact.co2_kg),
        )
        .group_by(TransportStageFact.vehicle_id)
        .all()
    )
    vehicles = {
        vid: v
        for vid, v in session.query(Vehicle.vehicle_id, Vehicle).all()  # type: ignore[assignment]
    }
    data = []
    for vid, dist, weight, cap, avg_load, co2 in rows:
        v = vehicles.get(vid)
        data.append(
            {
                "vehicle_id": vid,
                "license_plate": getattr(v, "license_plate", None) if v else None,
                "distance_km": float(dist or 0.0),
                "total_weight_kg": float(weight or 0.0),
                "total_capacity_kg": float(cap or 0.0),
                "avg_load_ratio": float(avg_load or 0.0),
                "total_co2_kg": float(co2 or 0.0),
            }
        )
    df = pd.DataFrame(data)
    logger.info("Loaded %d vehicle summary rows", len(df))
    return df


def get_order_summary(session: Session) -> pd.DataFrame:
    rows = (
        session.query(
            TransportStageFact.order_id,
            func.sum(TransportStageFact.distance_km),
            func.sum(TransportStageFact.co2_kg),
            func.avg(TransportStageFact.load_ratio),
        )
        .group_by(TransportStageFact.order_id)
        .all()
    )
    orders: Dict[int, Any] = {
        oid: o for oid, o in session.query(FreightOrder.order_id, FreightOrder).all()
    }
    data = []
    for oid, dist, co2, avg_load in rows:
        o = orders.get(oid)
        data.append(
            {
                "order_id": oid,
                "vehicle_id": getattr(o, "vehicle_id", None) if o else None,
                "distance_km": float(dist or 0.0),
                "total_co2_kg": float(co2 or 0.0),
                "avg_load_ratio": float(avg_load or 0.0),
            }
        )
    df = pd.DataFrame(data)
    logger.info("Loaded %d order summary rows", len(df))
    return df

