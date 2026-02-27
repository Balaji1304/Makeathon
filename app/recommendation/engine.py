"""
Optimization recommendation engine: ranked recommendations from ML predictions and rules.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.ml.features import build_features_from_session
from app.ml.inference import predict

logger = logging.getLogger(__name__)

LOAD_CONSOLIDATION_THRESHOLD = 0.40
EMISSION_PER_KM_HIGH_PERCENTILE = 0.85
LONG_DISTANCE_KM = 200.0
LOW_LOAD_THRESHOLD = 0.35


def _priority_score(row: pd.Series, rank: int) -> float:
    score = 0.0
    if row.get("predicted_load_ratio", 1) < LOAD_CONSOLIDATION_THRESHOLD:
        score += 40.0
    if row.get("emission_per_km", 0) > 0:
        score += 25.0
    if row.get("distance_km", 0) >= LONG_DISTANCE_KM and row.get("predicted_load_ratio", 0) < LOW_LOAD_THRESHOLD:
        score += 35.0
    return min(100.0, score + (10.0 - rank * 0.5))


def generate_recommendations(
    session: Session,
    emission_model_path: Optional[Path] = None,
    load_model_path: Optional[Path] = None,
    top_n: int = 50,
) -> List[Dict[str, Any]]:
    """
    Build features, run inference, apply rules; return ranked list of
    { order_id, priority_score, recommendation, estimated_co2_reduction }.
    """
    df = build_features_from_session(session)
    if df.empty:
        return []

    pred = predict(df, emission_model_path, load_model_path)
    by_order = pred.groupby("order_id").agg({
        "predicted_co2": "sum",
        "predicted_load_ratio": "mean",
        "emission_per_km": "mean",
        "distance_km": "sum",
    }).reset_index()

    recs = []
    for _, row in by_order.iterrows():
        recs.append({
            "order_id": int(row["order_id"]),
            "predicted_co2": float(row["predicted_co2"]),
            "predicted_load_ratio": float(row["predicted_load_ratio"]),
            "emission_per_km": float(row["emission_per_km"]),
            "distance_km": float(row["distance_km"]),
        })

    emission_high = by_order["emission_per_km"].quantile(EMISSION_PER_KM_HIGH_PERCENTILE)
    out = []
    for rank, r in enumerate(recs):
        order_id = r["order_id"]
        plr = r["predicted_load_ratio"]
        ekm = r["emission_per_km"]
        dist = r["distance_km"]
        reco = []
        est_reduction = 0.0

        if plr < LOAD_CONSOLIDATION_THRESHOLD:
            reco.append("suggest consolidation")
            est_reduction += r["predicted_co2"] * 0.15
        if ekm >= emission_high:
            reco.append("suggest vehicle replacement")
            est_reduction += r["predicted_co2"] * 0.20
        if dist >= LONG_DISTANCE_KM and plr < LOW_LOAD_THRESHOLD:
            reco.append("suggest route merge")
            est_reduction += r["predicted_co2"] * 0.10

        if not reco:
            continue
        recommendation = "; ".join(reco)
        priority = _priority_score(
            pd.Series({"predicted_load_ratio": plr, "emission_per_km": ekm, "distance_km": dist}),
            rank,
        )
        out.append({
            "order_id": order_id,
            "priority_score": round(priority, 1),
            "recommendation": recommendation,
            "estimated_co2_reduction": round(est_reduction, 2),
        })

    out.sort(key=lambda x: float(x["priority_score"]), reverse=True)
    return out[:top_n]
