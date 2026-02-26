import logging
from dataclasses import dataclass
from typing import List, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ConsolidationCandidate:
    order_ids: Tuple[int, int]
    avg_load_ratio: float
    combined_distance_km: float


def detect_low_load_consolidation(
    df_stages: pd.DataFrame,
    load_threshold: float = 0.4,
) -> List[ConsolidationCandidate]:
    """
    Heuristic: find pairs of low-load orders that share the same vehicle and
    similar distance; suitable for potential consolidation.
    """
    if df_stages.empty:
        return []

    df = df_stages.copy()
    df["load_ratio"] = df["load_ratio"].astype(float)
    low = df[df["load_ratio"] < load_threshold]
    if low.empty:
        logger.info("No low-load stages found for consolidation")
        return []

    grouped = (
        low.groupby("order_id")
        .agg(
            avg_load_ratio=("load_ratio", "mean"),
            distance_km=("distance_km", "sum"),
            vehicle_id=("vehicle_id", "first"),
        )
        .reset_index()
    )

    candidates: List[ConsolidationCandidate] = []
    for i in range(len(grouped)):
        for j in range(i + 1, len(grouped)):
            row_i = grouped.iloc[i]
            row_j = grouped.iloc[j]
            if row_i["vehicle_id"] != row_j["vehicle_id"]:
                continue
            avg_load = (row_i["avg_load_ratio"] + row_j["avg_load_ratio"]) / 2.0
            combined_dist = float(row_i["distance_km"] + row_j["distance_km"])
            candidates.append(
                ConsolidationCandidate(
                    order_ids=(int(row_i["order_id"]), int(row_j["order_id"])),
                    avg_load_ratio=avg_load,
                    combined_distance_km=combined_dist,
                )
            )
    logger.info("Detected %d low-load consolidation candidates", len(candidates))
    return candidates

