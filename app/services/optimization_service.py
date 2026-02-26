import logging
from typing import Dict

import pandas as pd
from sqlalchemy.orm import Session

from app.services.analytics_service import get_stage_facts
from app.optimization.scoring import (
    compute_optimization_score,
    rank_optimization_candidates,
)

logger = logging.getLogger(__name__)


def load_optimization_view(session: Session) -> pd.DataFrame:
    df = get_stage_facts(session)
    if df.empty:
        logger.warning("No data in transport_stage_fact for optimization view")
    return df


def get_kpi_candidates(
    session: Session,
    weights: Dict[str, float],
    top_n: int = 20,
) -> pd.DataFrame:
    df = load_optimization_view(session)
    if df.empty:
        return df
    df_scored = compute_optimization_score(df, **weights)
    ranked = rank_optimization_candidates(df_scored, top_n=top_n)
    logger.info("Selected top %d optimization candidates", len(ranked))
    return ranked

