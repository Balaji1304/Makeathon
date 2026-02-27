"""
What-if simulator: given order_id and alternative vehicle type, simulate new load ratio,
predicted emissions, CO2 savings %, utilization improvement using ML predictions.
"""
import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.database.models import TransportType, VehicleAttributes
from app.ml.features import build_features_from_session
from app.ml.inference import predict

logger = logging.getLogger(__name__)


def _capacity_by_type_name(session: Session) -> Dict[str, float]:
    q = (
        session.query(TransportType.name, VehicleAttributes.capacity_kg)
        .join(VehicleAttributes, TransportType.transport_type_id == VehicleAttributes.transport_type_id)
    )
    return {str(name): float(cap) for name, cap in q.all() if name and cap is not None}


def simulate_order(
    session: Session,
    order_id: int,
    alternative_vehicle_type: str,
    emission_model_path: Optional[Any] = None,
    load_model_path: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Simulate switching the given order to an alternative vehicle type using ML predictions.
    Returns current vs alternative predicted_co2, predicted_load_ratio, CO2 savings %, utilization change.
    """
    full_df = build_features_from_session(session)
    if full_df.empty:
        return {"error": "No fact data", "order_id": order_id}

    order_rows = full_df[full_df["order_id"] == order_id]
    if order_rows.empty:
        return {"error": f"No stages for order_id={order_id}", "order_id": order_id}

    type_to_capacity = _capacity_by_type_name(session)
    alt_capacity = type_to_capacity.get(alternative_vehicle_type.strip())
    if alt_capacity is None:
        return {
            "error": f"Unknown vehicle type: {alternative_vehicle_type}",
            "order_id": order_id,
            "available_types": list(type_to_capacity.keys()),
        }

    current = predict(order_rows.copy(), emission_model_path, load_model_path)
    cur_co2 = current["predicted_co2"].sum()
    cur_load = current["predicted_load_ratio"].mean()

    type_to_code = full_df.drop_duplicates("transport_type")[["transport_type", "vehicle_type_encoded"]].set_index("transport_type")["vehicle_type_encoded"].to_dict()
    alt_type = alternative_vehicle_type.strip()
    code = type_to_code.get(alt_type)
    if code is None:
        code = int(max(full_df["vehicle_type_encoded"].max(), 0) + 1)

    alt_df = order_rows.copy()
    alt_df["vehicle_capacity"] = alt_capacity
    alt_df["load_ratio"] = (alt_df["load_weight"] / alt_capacity).clip(0.0, 2.0)
    alt_df["vehicle_type_encoded"] = code
    if "emission_per_km" in alt_df.columns:
        alt_df["emission_per_km"] = 0.0

    alt_pred = predict(alt_df, emission_model_path, load_model_path)
    alt_co2 = alt_pred["predicted_co2"].sum()
    alt_load = alt_pred["predicted_load_ratio"].mean()

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