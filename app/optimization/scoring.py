import logging
import pandas as pd

logger = logging.getLogger(__name__)


def compute_optimization_score(
    df: pd.DataFrame,
    low_load_weight: float,
    distance_weight: float,
    emission_weight: float,
    target_load: float = 0.8,
) -> pd.DataFrame:
    if df.empty:
        return df
    work = df.copy()
    load = work.get("load_ratio", 0.0).astype(float)
    distance = work.get("distance_km", 0.0).astype(float)
    co2 = work.get("co2_kg", 0.0).astype(float)
    load_gap = (target_load - load).clip(lower=0.0)
    work["load_gap"] = load_gap
    work["optimization_score"] = (
        low_load_weight * load_gap
        + distance_weight * distance
        + emission_weight * co2
    )
    logger.info("Computed optimization scores for %d rows", len(work))
    return work


def rank_optimization_candidates(
    df_scored: pd.DataFrame,
    top_n: int = 20,
) -> pd.DataFrame:
    if df_scored.empty:
        return df_scored
    cols = ["optimization_score", "order_id", "vehicle_id", "distance_km", "co2_kg", "load_ratio"]
    existing_cols = [c for c in cols if c in df_scored.columns]
    ranked = df_scored.sort_values("optimization_score", ascending=False)
    return ranked[existing_cols].head(top_n)

