import logging
from dataclasses import dataclass
from typing import Dict

import pandas as pd

from app.database.models import VehicleAttributes, TransportType, Vehicle
from app.database.connection import SessionLocal

logger = logging.getLogger(__name__)


@dataclass
class ScenarioResult:
    total_co2_before: float
    total_co2_after: float
    co2_saved: float
    avg_load_before: float
    avg_load_after: float
    load_ratio_improvement: float


def _load_vehicle_attribute_map() -> Dict[int, VehicleAttributes]:
    session = SessionLocal()
    try:
        rows = (
            session.query(Vehicle.transport_type_id, VehicleAttributes)
            .join(
                VehicleAttributes,
                Vehicle.transport_type_id == VehicleAttributes.transport_type_id,
            )
            .all()
        )
        return {int(tt_id): va for tt_id, va in rows}
    finally:
        session.close()


def simulate_vehicle_change(
    df_stages: pd.DataFrame,
    new_transport_type_by_vehicle: Dict[int, str],
) -> pd.DataFrame:
    """
    Simulate assigning different transport types (e.g. downsizing).
    new_transport_type_by_vehicle maps vehicle_id -> new TransportType.name.
    """
    if df_stages.empty:
        return df_stages

    session = SessionLocal()
    try:
        name_to_tt = {
            name: tt_id
            for tt_id, name in session.query(
                TransportType.transport_type_id, TransportType.name
            ).all()
        }
        va_by_tt = {
            vt.transport_type_id: vt
            for vt in session.query(VehicleAttributes).all()
        }
    finally:
        session.close()

    df = df_stages.copy()
    df["vehicle_id"] = df["vehicle_id"].astype(int)

    df["distance_km_before"] = df["distance_km"]
    df["load_ratio_before"] = df["load_ratio"]
    df["co2_kg_before"] = df["co2_kg"]

    new_vehicle_capacity = []
    new_co2 = []
    for _, row in df.iterrows():
        vid = int(row["vehicle_id"])
        tt_name = new_transport_type_by_vehicle.get(vid)
        if not tt_name:
            new_vehicle_capacity.append(row["vehicle_capacity_kg"])
            new_co2.append(row["co2_kg"])
            continue
        tt_id = name_to_tt.get(tt_name)
        va = va_by_tt.get(tt_id) if tt_id is not None else None
        if not va:
            new_vehicle_capacity.append(row["vehicle_capacity_kg"])
            new_co2.append(row["co2_kg"])
            continue
        cap = float(va.capacity_kg or 0.0)
        load_ratio = (
            0.0 if cap <= 0 else float(row["total_weight_kg"]) / cap
        )
        co2_empty = float(va.co2_empty_kg_km or 0.0)
        co2_loaded = float(va.co2_loaded_kg_km or 0.0)
        co2 = float(row["distance_km"]) * (
            co2_empty + load_ratio * (co2_loaded - co2_empty)
        )
        new_vehicle_capacity.append(cap)
        new_co2.append(co2)

    df["vehicle_capacity_kg_after"] = new_vehicle_capacity
    df["co2_kg_after"] = new_co2
    return df


def compare_scenarios(df_before: pd.DataFrame, df_after: pd.DataFrame) -> ScenarioResult:
    total_co2_before = float(df_before["co2_kg"].sum()) if not df_before.empty else 0.0
    total_co2_after = float(df_after.get("co2_kg_after", df_after["co2_kg"]).sum()) if not df_after.empty else 0.0
    co2_saved = total_co2_before - total_co2_after
    avg_load_before = float(df_before.get("load_ratio", 0.0).mean()) if not df_before.empty else 0.0
    avg_load_after = float(df_after.get("load_ratio_after", df_after.get("load_ratio", 0.0)).mean()) if not df_after.empty else 0.0
    return ScenarioResult(
        total_co2_before=total_co2_before,
        total_co2_after=total_co2_after,
        co2_saved=co2_saved,
        avg_load_before=avg_load_before,
        avg_load_after=avg_load_after,
        load_ratio_improvement=avg_load_after - avg_load_before,
    )

