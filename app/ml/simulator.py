"""
What-if simulator: given order_id and alternative vehicle type, simulate new load ratio,
predicted emissions, CO2 savings %, utilization improvement.
Uses physics-based CO2 calculation (known formula) + ML for load ratio prediction.
"""
import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.database.models import TransportType, VehicleAttributes
from app.ml.features import build_features_from_session
from app.ml.inference import predict

logger = logging.getLogger(__name__)


def _vehicle_attributes_by_type(session: Session) -> Dict[str, Dict[str, float]]:
    """Return {type_name: {capacity_kg, co2_empty_kg_km, co2_loaded_kg_km}} for all vehicle types."""
    q = (
        session.query(TransportType.name, VehicleAttributes)
        .join(VehicleAttributes, TransportType.transport_type_id == VehicleAttributes.transport_type_id)
    )
    result: Dict[str, Dict[str, float]] = {}
    for name, va in q.all():
        if name:
            result[name.strip()] = {
                "capacity_kg": float(va.capacity_kg or 0.0),
                "co2_empty_kg_km": float(va.co2_empty_kg_km or 0.0),
                "co2_loaded_kg_km": float(va.co2_loaded_kg_km or 0.0),
            }
    return result


def _compute_co2_physics(distance_km: float, load_weight: float, capacity_kg: float,
                         co2_empty: float, co2_loaded: float) -> float:
    """Compute CO2 using the known physics formula from fact_builder."""
    if capacity_kg <= 0:
        return 0.0
    load_ratio = min(max(load_weight / capacity_kg, 0.0), 2.0)
    return distance_km * (co2_empty + load_ratio * (co2_loaded - co2_empty))


def simulate_order(
    session: Session,
    order_id: int,
    alternative_vehicle_type: str,
    emission_model_path: Optional[Any] = None,
    load_model_path: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Simulate switching the given order to an alternative vehicle type.
    CO2 is computed via physics formula; load ratio is ML-predicted.
    """
    order_rows = build_features_from_session(session, order_id=order_id)
    if order_rows.empty:
        return {"error": f"No stages for order_id={order_id}", "order_id": order_id}

    attrs_by_type = _vehicle_attributes_by_type(session)

    alt_type = alternative_vehicle_type.strip()
    alt_attrs = attrs_by_type.get(alt_type)
    if alt_attrs is None:
        return {
            "error": f"Unknown vehicle type: {alternative_vehicle_type}",
            "order_id": order_id,
            "available_types": list(attrs_by_type.keys()),
        }

    # Determine the current vehicle type from the order rows
    current_type = order_rows["transport_type"].iloc[0] if "transport_type" in order_rows.columns else None
    current_attrs = attrs_by_type.get(current_type) if current_type else None

    # --- CO2: physics-based for both current and alternative ---
    cur_co2 = 0.0
    alt_co2 = 0.0
    for _, row in order_rows.iterrows():
        dist = float(row.get("distance_km", 0.0))
        weight = float(row.get("load_weight", 0.0))

        if current_attrs:
            cur_co2 += _compute_co2_physics(
                dist, weight, current_attrs["capacity_kg"],
                current_attrs["co2_empty_kg_km"], current_attrs["co2_loaded_kg_km"],
            )
        else:
            # Fallback: use the actual co2_emission from the fact table
            cur_co2 += float(row.get("co2_emission", 0.0))

        alt_co2 += _compute_co2_physics(
            dist, weight, alt_attrs["capacity_kg"],
            alt_attrs["co2_empty_kg_km"], alt_attrs["co2_loaded_kg_km"],
        )

    # --- Load ratio: ML-predicted for current ---
    current = predict(order_rows.copy(), emission_model_path, load_model_path)
    cur_load = current["predicted_load_ratio"].mean()

    # --- Load ratio: physics-based for alternative (weight / new capacity) ---
    total_weight = float(order_rows["load_weight"].sum())
    alt_capacity = alt_attrs["capacity_kg"]
    alt_load = (total_weight / alt_capacity) if alt_capacity > 0 else 0.0

    co2_savings_pct = (1.0 - alt_co2 / cur_co2) * 100.0 if cur_co2 > 0 else 0.0
    utilization_improvement = float(alt_load - cur_load)

    return {
        "order_id": order_id,
        "alternative_vehicle_type": alternative_vehicle_type,
        "current_predicted_co2": float(cur_co2),
        "alternative_predicted_co2": float(alt_co2),
        "current_predicted_load_ratio": float(cur_load),
        "alternative_predicted_load_ratio": float(alt_load),
        "co2_savings_percent": float(co2_savings_pct),
        "utilization_improvement": utilization_improvement,
    }