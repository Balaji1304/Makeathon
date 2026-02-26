import logging
from typing import Dict, List

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database.models import (
    FreightOrder,
    FreightOrderItem,
    FreightOrderStage,
    TransportStageFact,
    Vehicle,
    VehicleAttributes,
    TransportType,
)

logger = logging.getLogger(__name__)


def _truncate_fact_table(session: Session) -> None:
    session.execute(text("TRUNCATE transport_stage_fact"))
    logger.info("Truncated transport_stage_fact")


def build_transport_stage_fact(session: Session) -> int:
    """
    Rebuild the transport_stage_fact table from normalized movement data.

    Idempotent: truncates the table before inserting new facts.
    Returns number of inserted rows.
    """
    logger.info("Building transport_stage_fact")
    _truncate_fact_table(session)
    session.flush()

    order_weights: Dict[int, float] = {
        order_id: float(total_weight or 0.0)
        for order_id, total_weight in session.query(
            FreightOrderItem.order_id,
            func.sum(FreightOrderItem.weight),
        )
        .group_by(FreightOrderItem.order_id)
        .all()
    }

    capacities: Dict[int, float] = {}
    for vt_id, cap in (
        session.query(
            VehicleAttributes.transport_type_id, VehicleAttributes.capacity_kg
        ).all()
    ):
        capacities[int(vt_id)] = float(cap or 0.0)

    stage_query = (
        session.query(
            FreightOrderStage.stage_id,
            FreightOrderStage.order_id,
            FreightOrderStage.from_stop_id,
            FreightOrderStage.to_stop_id,
            FreightOrderStage.distance,
            FreightOrderStage.duration,
            FreightOrder.vehicle_id,
            Vehicle.transport_type_id,
            TransportType.name,
            FreightOrder.total_weight,
        )
        .join(FreightOrder, FreightOrderStage.order_id == FreightOrder.order_id)
        .join(Vehicle, FreightOrder.vehicle_id == Vehicle.vehicle_id)
        .join(
            TransportType,
            Vehicle.transport_type_id == TransportType.transport_type_id,
        )
    )

    facts: List[TransportStageFact] = []
    for (
        _stage_id,
        order_id,
        from_stop_id,
        to_stop_id,
        distance,
        duration,
        vehicle_id,
        transport_type_id,
        transport_type_name,
        order_total_weight,
    ) in stage_query:
        if distance is None:
            continue

        order_id_int = int(order_id) if order_id is not None else None
        vehicle_id_int = int(vehicle_id) if vehicle_id is not None else None
        tt_id = int(transport_type_id) if transport_type_id is not None else None

        total_weight = order_weights.get(order_id_int or 0)
        if total_weight is None:
            total_weight = float(order_total_weight or 0.0)

        capacity = capacities.get(tt_id or -1, 0.0)
        if capacity <= 0.0:
            load_ratio = 0.0
        else:
            load_ratio = float(total_weight) / capacity

        va = (
            session.query(VehicleAttributes)
            .filter(VehicleAttributes.transport_type_id == tt_id)
            .first()
        )
        if not va:
            continue
        co2_empty = float(va.co2_empty_kg_km or 0.0)
        co2_loaded = float(va.co2_loaded_kg_km or 0.0)
        distance_km = float(distance or 0.0)
        duration_min = float(duration or 0.0)

        co2_kg = distance_km * (
            co2_empty + load_ratio * (co2_loaded - co2_empty)
        )

        facts.append(
            TransportStageFact(
                order_id=order_id_int,
                vehicle_id=vehicle_id_int,
                transport_type=transport_type_name,
                from_stop_id=int(from_stop_id) if from_stop_id is not None else None,
                to_stop_id=int(to_stop_id) if to_stop_id is not None else None,
                distance_km=distance_km,
                duration_min=duration_min,
                total_weight_kg=total_weight,
                vehicle_capacity_kg=capacity,
                load_ratio=load_ratio,
                co2_kg=co2_kg,
            )
        )

    if not facts:
        logger.warning("No stages found to build transport_stage_fact")
        return 0

    session.bulk_save_objects(facts)
    logger.info("Inserted %d rows into transport_stage_fact", len(facts))
    return len(facts)


MATERIALIZED_VIEWS_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS emissions_per_vehicle AS
SELECT
    vehicle_id,
    SUM(distance_km) AS total_distance,
    SUM(co2_kg)     AS total_co2,
    AVG(load_ratio) AS avg_load_ratio
FROM transport_stage_fact
GROUP BY vehicle_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS emissions_per_order AS
SELECT
    order_id,
    SUM(distance_km) AS total_distance,
    SUM(co2_kg)      AS total_co2,
    AVG(load_ratio)  AS avg_load_ratio
FROM transport_stage_fact
GROUP BY order_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS fleet_utilization AS
SELECT
    vehicle_id,
    SUM(total_weight_kg)        AS total_weight_kg,
    SUM(vehicle_capacity_kg)    AS total_capacity_kg,
    CASE
        WHEN SUM(vehicle_capacity_kg) > 0
            THEN SUM(total_weight_kg) / SUM(vehicle_capacity_kg)
        ELSE 0
    END AS avg_load_ratio,
    SUM(distance_km)            AS total_distance_km
FROM transport_stage_fact
GROUP BY vehicle_id;

CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW emissions_per_vehicle;
    REFRESH MATERIALIZED VIEW emissions_per_order;
    REFRESH MATERIALIZED VIEW fleet_utilization;
END;
$$;
"""


def ensure_materialized_views(session: Session) -> None:
    session.execute(text(MATERIALIZED_VIEWS_SQL))
    logger.info("Ensured analytics materialized views and refresh function exist")


def refresh_materialized_views(session: Session) -> None:
    session.execute(text("SELECT refresh_analytics_materialized_views()"))
    logger.info("Refreshed analytics materialized views")

