"""
ML feature engineering from transport_stage_fact.
Reads via SQLAlchemy, returns a pandas DataFrame with NULL-safe features.
"""
import logging
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.database.models import TransportStageFact

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "distance_km",
    "load_weight",
    "vehicle_capacity",
    "load_ratio",
    "emission_per_km",
    "vehicle_type_encoded",
    "weekday",
]
FEATURE_COLS_EMISSION = [
    "distance_km",
    "load_weight",
    "vehicle_capacity",
    "load_ratio",
    "vehicle_type_encoded",
    "weekday",
]
FEATURE_COLS_LOAD = [
    "distance_km",
    "load_weight",
    "vehicle_capacity",
    "emission_per_km",
    "vehicle_type_encoded",
    "weekday",
]
TARGET_CO2 = "co2_emission"
TARGET_LOAD = "load_ratio"


def _safe_float(x: Optional[float], default: float = 0.0) -> float:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return default
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


from app.database.models import TransportStageFact, TransportType


def build_features_from_session(session: Session, order_id: Optional[int] = None) -> pd.DataFrame:
    """
    Read transport_stage_fact and build ML-ready features.
    Returns DataFrame with FEATURE_COLS + co2_emission (alias of co2_kg), load_ratio.
    """
    # Fetch all unique transport types once to ensure STABLE label encoding
    # otherwise vehicle_type_encoded changes based on dataframe row order/subset
    all_types = [t.name for t in session.query(TransportType.name).order_by(TransportType.name).all()]
    types_seen = {name.strip(): i for i, name in enumerate(all_types)}

    query = session.query(TransportStageFact)
    if order_id is not None:
        query = query.filter(TransportStageFact.order_id == order_id)
        
    rows = query.all()
    if not rows:
        logger.warning("No rows in transport_stage_fact")
        return pd.DataFrame()

    records = []
    for r in rows:
        distance_km = _safe_float(r.distance_km)
        load_weight = _safe_float(r.total_weight_kg)
        vehicle_capacity = _safe_float(r.vehicle_capacity_kg)
        load_ratio = _safe_float(r.load_ratio)
        co2_kg = _safe_float(r.co2_kg)

        emission_per_km = co2_kg / distance_km if distance_km > 0 else 0.0

        tt = (r.transport_type or "").strip()
        vehicle_type_encoded = types_seen.get(tt, -1)

        ts = r.created_at
        weekday = ts.weekday() if ts is not None else -1

        records.append({
            "order_id": r.order_id,
            "vehicle_id": r.vehicle_id,
            "transport_type": tt or "",
            "distance_km": distance_km,
            "load_weight": load_weight,
            "vehicle_capacity": vehicle_capacity,
            "load_ratio": load_ratio,
            "emission_per_km": emission_per_km,
            "vehicle_type_encoded": vehicle_type_encoded,
            "weekday": weekday,
            "co2_emission": co2_kg,
        })

    df = pd.DataFrame(records)
    df = df.fillna(0.0)
    logger.info("Built features for %d rows (order_id=%s)", len(df), order_id)
    return df
