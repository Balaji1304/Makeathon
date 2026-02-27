"""
Load trained models and return predicted_co2 and predicted_load_ratio for given DataFrame rows.
"""
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd


logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
EMISSION_MODEL_PATH = _MODELS_DIR / "emission_model.joblib"
LOAD_MODEL_PATH = _MODELS_DIR / "load_model.joblib"


def _load_artifact(path: Path) -> Dict[str, Any]:
    import joblib
    if not path.exists():
        raise FileNotFoundError(f"Model not found: {path}. Run train-models first.")
    return joblib.load(path)


def predict(
    df: pd.DataFrame,
    emission_model_path: Optional[Path] = None,
    load_model_path: Optional[Path] = None,
) -> pd.DataFrame:
    """
    Accept dataframe with feature columns (from features.py). Returns copy of df
    with added columns: predicted_co2, predicted_load_ratio.
    """
    emission_model_path = emission_model_path or EMISSION_MODEL_PATH
    load_model_path = load_model_path or LOAD_MODEL_PATH

    emission_artifact = _load_artifact(emission_model_path)
    load_artifact = _load_artifact(load_model_path)

    pipe_emission = emission_artifact["model"]
    pipe_load = load_artifact["model"]
    cols_emission = emission_artifact["feature_columns"]
    cols_load = load_artifact["feature_columns"]

    out = df.copy()
    for c in cols_emission:
        if c not in out.columns:
            out[c] = 0.0
    for c in cols_load:
        if c not in out.columns:
            out[c] = 0.0

    X_emission = out[cols_emission].fillna(0.0)
    X_load = out[cols_load].fillna(0.0)

    out["predicted_co2"] = pipe_emission.predict(X_emission)
    out["predicted_load_ratio"] = pipe_load.predict(X_load)
    return out
