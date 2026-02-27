"""
Train emission and load-ratio models with RandomForestRegressor; persist with joblib.
"""
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.dataset import get_feature_matrix, get_ml_dataset
from app.ml.features import TARGET_CO2, TARGET_LOAD

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
EMISSION_MODEL_PATH = _MODELS_DIR / "emission_model.joblib"
LOAD_MODEL_PATH = _MODELS_DIR / "load_model.joblib"


def _make_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(random_state=42)),
    ])


def train_emission_model(
    train_df: pd.DataFrame,
    test_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    X_train, y_train = get_feature_matrix(train_df, TARGET_CO2)
    pipe = _make_pipeline()
    pipe.fit(X_train, y_train)
    metrics = {}
    if test_df is not None and not test_df.empty:
        X_test, y_test = get_feature_matrix(test_df, TARGET_CO2)
        from sklearn.metrics import mean_absolute_error, r2_score
        pred = pipe.predict(X_test)
        metrics["mae"] = float(mean_absolute_error(y_test, pred))
        metrics["r2"] = float(r2_score(y_test, pred))
    return {
        "model": pipe,
        "feature_columns": list(X_train.columns),
        "metrics": metrics,
    }


def train_load_model(
    train_df: pd.DataFrame,
    test_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    X_train, y_train = get_feature_matrix(train_df, TARGET_LOAD)
    pipe = _make_pipeline()
    pipe.fit(X_train, y_train)
    metrics = {}
    if test_df is not None and not test_df.empty:
        X_test, y_test = get_feature_matrix(test_df, TARGET_LOAD)
        from sklearn.metrics import mean_absolute_error, r2_score
        pred = pipe.predict(X_test)
        metrics["mae"] = float(mean_absolute_error(y_test, pred))
        metrics["r2"] = float(r2_score(y_test, pred))
    return {
        "model": pipe,
        "feature_columns": list(X_train.columns),
        "metrics": metrics,
    }


def run_training(
    session=None,
    cache_path: Optional[Path] = None,
    use_cache: bool = False,
    models_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Build dataset, train both models, persist to models_dir (default: project models/).
    Returns dict with paths and metrics.
    """
    models_dir = models_dir or _MODELS_DIR
    models_dir.mkdir(parents=True, exist_ok=True)

    train_df, test_df, _ = get_ml_dataset(
        session=session,
        cache_path=cache_path,
        use_cache=use_cache,
    )
    if train_df.empty:
        raise ValueError("No training data: transport_stage_fact is empty or feature build failed")

    emission_artifact = train_emission_model(train_df, test_df)
    load_artifact = train_load_model(train_df, test_df)

    joblib.dump(emission_artifact, models_dir / "emission_model.joblib")
    joblib.dump(load_artifact, models_dir / "load_model.joblib")
    logger.info(
        "Saved emission model (test MAE=%.2f R2=%.3f) and load model (test MAE=%.3f R2=%.3f)",
        emission_artifact["metrics"].get("mae", 0),
        emission_artifact["metrics"].get("r2", 0),
        load_artifact["metrics"].get("mae", 0),
        load_artifact["metrics"].get("r2", 0),
    )
    return {
        "emission_path": str(models_dir / "emission_model.joblib"),
        "load_path": str(models_dir / "load_model.joblib"),
        "emission_metrics": emission_artifact["metrics"],
        "load_metrics": load_artifact["metrics"],
    }
