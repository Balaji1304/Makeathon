"""
Dataset builder: fetch from PostgreSQL, apply feature engineering, train/test split, optional parquet cache.
"""
import logging
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd

from app.database.connection import SessionLocal
from app.ml.features import (
    FEATURE_COLS_EMISSION,
    FEATURE_COLS_LOAD,
    TARGET_CO2,
    build_features_from_session,
)

logger = logging.getLogger(__name__)

# Default cache under project root (no hardcoded absolute path)
def _default_cache_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "data" / "ml_cache"


def get_ml_dataset(
    session=None,
    cache_path: Optional[Path] = None,
    use_cache: bool = False,
    test_ratio: float = 0.2,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Fetch fact data, build features, split train/test.
    Returns (X_train, X_test, full_df_with_targets).
    full_df_with_targets has index aligned for later lookups (order_id, etc.).
    """
    own_session = False
    if session is None:
        session = SessionLocal()
        own_session = True
    try:
        if use_cache and cache_path is not None and cache_path.exists():
            df = pd.read_parquet(cache_path)
            logger.info("Loaded ML dataset from cache: %s (%d rows)", cache_path, len(df))
        else:
            df = build_features_from_session(session)
            if df.empty:
                return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                df.to_parquet(cache_path, index=False)
                logger.info("Cached ML dataset to %s", cache_path)
        # Train/test split (time-agnostic random split)
        from sklearn.model_selection import train_test_split
        train_df, test_df = train_test_split(
            df, test_size=test_ratio, random_state=random_state
        )
        return train_df, test_df, df
    finally:
        if own_session:
            session.close()


def get_feature_matrix(
    df: pd.DataFrame,
    target: str,
) -> Tuple[pd.DataFrame, pd.Series]:
    """Extract feature matrix X and target y. Uses emission/load feature sets to avoid leakage."""
    if target == TARGET_CO2:
        feature_cols = [c for c in FEATURE_COLS_EMISSION if c in df.columns]
    else:
        feature_cols = [c for c in FEATURE_COLS_LOAD if c in df.columns]
    X = df[feature_cols].copy().fillna(0.0)
    y = df[target]
    return X, y
