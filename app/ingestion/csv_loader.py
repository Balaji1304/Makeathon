import logging
from pathlib import Path
from dataclasses import dataclass, field

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.database.models import (
    Address,
    TransportType,
    Vehicle,
    VehicleAttributes,
    FreightUnit,
    FreightUnitStop,
    FreightOrder,
    FreightOrderItem,
    FreightOrderStop,
    FreightOrderStage,
)

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def _get_transport_type_code_to_id(session: Session) -> dict[str, int]:
    rows = session.query(TransportType.transport_type_id, TransportType.name).all()
    return {str(name): int(tid) for tid, name in rows}


@dataclass
class TableMapping:
    filename: str
    model: type
    column_map: dict[str, str]
    date_columns: list[str] = field(default_factory=list)
    subdir: str | None = None
    alt_filenames: list[str] = field(default_factory=list)
    sep: str = ","


def _resolve_csv_path(data_dir: Path, mapping: TableMapping) -> Path | None:
    base = data_dir / mapping.subdir if mapping.subdir else data_dir
    candidates = [mapping.filename] + mapping.alt_filenames
    for name in candidates:
        p = base / name
        if p.exists():
            return p
        if name.endswith(".csv"):
            p2 = base / (name + ".csv")
            if p2.exists():
                return p2
    if mapping.subdir:
        for name in candidates:
            p = data_dir / name
            if p.exists():
                return p
            if name.endswith(".csv"):
                p2 = data_dir / (name + ".csv")
                if p2.exists():
                    return p2
    return None


# FK-dependency order — master first, then units, then orders
LOAD_ORDER: list[TableMapping] = [
    TableMapping(
        filename="ADDRESSDATA.csv",
        model=Address,
        column_map={
            "LOCATION": "external_code",
            "NAME": "name",
            "CITY": "city",
            "POSTL CODE": "postal_code",
            "STREET": "street",
            "C/R": "country",
        },
        sep=";",
    ),
    TableMapping(
        filename="MEANS_OF_TRANSPORT.csv",
        model=TransportType,
        column_map={
            "MEANS OF TRANSPORT": "name",
            "MTR DESCRIPTION": "description",
        },
        sep=";",
    ),
    TableMapping(
        filename="RESSOURCE_HEAD.csv",
        model=Vehicle,
        column_map={
            "RESOURCE": "license_plate",
            "MEANS OF TRANSPORT": "transport_type_id",
        },
        sep=";",
    ),
    TableMapping(
        filename="RESOURCE_EQUIPMENT_ATTRIBUTES.csv",
        model=VehicleAttributes,
        column_map={
            "MEANS OF TRANSPORT": "transport_type_id",
            "MAXIMUM PAYLOAD WEIGHT": "capacity_kg",
            "CUBIC CAPACITY": "capacity_volume",
            "CO₂ EMISSIONS (EMPTY LOAD)": "co2_empty_kg_km",
            "CO₂ EMISSIONS (FULL LOAD)": "co2_loaded_kg_km",
        },
        alt_filenames=["RESSOURCE_EQUIPTMENT_ATTRIBUTES.csv"],
        sep=";",
    ),
]


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace and uppercase all column names for consistent matching."""
    df.columns = df.columns.str.strip().str.upper().str.rstrip(",")
    return df


def _pick_column(df: pd.DataFrame, name: str) -> str | None:
    if name in df.columns:
        return name
    for c in df.columns:
        if c.startswith(name + "."):
            return c
    for c in df.columns:
        if c.startswith(name):
            return c
    return None


def _parse_hhmm_to_minutes(value: object) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s == ",":
        return None
    parts = s.split(":")
    if len(parts) < 2:
        return None
    try:
        h = int(parts[0])
        m = int(parts[1])
        return float(h * 60 + m)
    except ValueError:
        return None


def _parse_number(value: object) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip().replace(" ", "")
    if not s or s == ",":
        return None
    if "E+" in s.upper():
        try:
            return float(s.replace(",", "."))
        except ValueError:
            return None
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_distance_km(value: object) -> float | None:
    raw = _parse_number(value)
    if raw is None:
        return None
    candidates = [raw, raw / 1_000.0, raw / 1_000_000.0]
    for v in candidates:
        if 5.0 <= v <= 5000.0:
            return v
    return candidates[-1]


def _ensure_addresses(session: Session, codes: set[str]) -> dict[str, int]:
    existing = (
        session.query(Address.address_id, Address.external_code)
        .filter(Address.external_code.in_(list(codes)))
        .all()
    )
    code_to_id = {str(code): int(aid) for aid, code in existing if code is not None}
    missing = [c for c in codes if c not in code_to_id]
    if missing:
        session.bulk_insert_mappings(
            Address,
            [{"external_code": c, "name": c} for c in missing],
        )
        session.flush()
        existing2 = (
            session.query(Address.address_id, Address.external_code)
            .filter(Address.external_code.in_(missing))
            .all()
        )
        code_to_id.update({str(code): int(aid) for aid, code in existing2 if code is not None})
    return code_to_id


def _load_movement(data_dir: Path, session: Session) -> dict[str, int]:
    movement_dir = data_dir / "movement"
    summary: dict[str, int] = {
        "freight_units": 0,
        "freight_unit_stops": 0,
        "freight_orders": 0,
        "freight_order_stops": 0,
        "freight_order_stages": 0,
    }
    if not movement_dir.exists():
        logger.warning("Movement folder not found, skipping: %s", movement_dir)
        return summary

    fu_header = movement_dir / "normal_planning_freight_unit_header.csv"
    if fu_header.exists():
        df = _normalize_columns(pd.read_csv(fu_header, sep=";", encoding="utf-8", on_bad_lines="warn"))
        df_small = pd.DataFrame()
        df_small["source_key"] = df["KEY"].astype(str)
        df_small["weight"] = df[_pick_column(df, "GROSS WEIGHT")].map(_parse_number) if _pick_column(df, "GROSS WEIGHT") else None
        df_small["volume"] = df[_pick_column(df, "GROSS VOLUME")].map(_parse_number) if _pick_column(df, "GROSS VOLUME") else None
        df_small["direct_distance"] = df[_pick_column(df, "TOTAL DISTANCE")].map(_parse_distance_km) if _pick_column(df, "TOTAL DISTANCE") else None
        df_small["estimated_duration"] = df[_pick_column(df, "TOTAL NET DURATION")].map(_parse_hhmm_to_minutes) if _pick_column(df, "TOTAL NET DURATION") else None
        summary["freight_units"] = _bulk_insert(session, FreightUnit, df_small)

    fu_key_to_id = {
        sk: uid
        for uid, sk in session.query(FreightUnit.unit_id, FreightUnit.source_key).all()
        if sk
    }

    fu_stops = movement_dir / "normal_planning_freight_unit_stops.csv"
    if fu_stops.exists() and fu_key_to_id:
        df = _normalize_columns(pd.read_csv(fu_stops, sep=";", encoding="utf-8", on_bad_lines="warn"))
        loc_col = _pick_column(df, "LOCATION")
        if loc_col:
            codes = set(df[loc_col].dropna().astype(str).str.strip())
            addr_map = _ensure_addresses(session, codes)
        else:
            addr_map = {}
        records = []
        for _, r in df.iterrows():
            parent = str(r.get("PARENT_KEY", "")).strip()
            unit_id = fu_key_to_id.get(parent)
            if not unit_id:
                continue
            loc = str(r.get(loc_col, "")).strip() if loc_col else ""
            addr_id = addr_map.get(loc)
            if not addr_id:
                continue
            stop_cat = str(r.get("STOP CATEGORY", "")).strip().upper()
            stop_type = "Outbound" if stop_cat == "O" else "Inbound" if stop_cat == "I" else None
            if not stop_type:
                continue
            seq = pd.to_numeric(r.get("STOP"), errors="coerce")
            if pd.isna(seq):
                continue
            records.append(
                {
                    "unit_id": unit_id,
                    "address_id": addr_id,
                    "stop_type": stop_type,
                    "sequence_number": int(seq),
                    "source_key": str(r.get("KEY", "")).strip() or None,
                    "parent_source_key": parent or None,
                }
            )
        if records:
            summary["freight_unit_stops"] = _bulk_insert(session, FreightUnitStop, pd.DataFrame(records))

    fo_header = movement_dir / "normal_planning_freight_order_header.csv"
    if fo_header.exists():
        df = _normalize_columns(pd.read_csv(fo_header, sep=";", encoding="utf-8", on_bad_lines="warn"))
        mot_col = _pick_column(df, "MEANS OF TRANSPORT")
        vehicles_rows = (
            session.query(Vehicle.vehicle_id, TransportType.name)
            .join(TransportType, Vehicle.transport_type_id == TransportType.transport_type_id)
            .filter(Vehicle.is_active.is_(True))
            .all()
        )
        mot_to_vehicle = {}
        for vid, mot in vehicles_rows:
            mot_to_vehicle.setdefault(str(mot), []).append(int(vid))

        records = []
        for _, r in df.iterrows():
            mot = str(r.get(mot_col, "")).strip() if mot_col else ""
            vids = mot_to_vehicle.get(mot) or []
            if not vids:
                continue
            records.append(
                {
                    "source_key": str(r.get("KEY", "")).strip(),
                    "vehicle_id": vids[0],
                    "total_weight": _parse_number(r.get("NET WEIGHT")),
                    "total_volume": _parse_number(r.get("GROSS VOLUME")),
                    "total_distance": _parse_distance_km(r.get("TOTAL DISTANCE")),
                    "total_duration": _parse_hhmm_to_minutes(r.get("TOTAL NET DURATION")),
                }
            )
        if records:
            summary["freight_orders"] = _bulk_insert(session, FreightOrder, pd.DataFrame(records))

    fo_key_to_id = {
        sk: oid
        for oid, sk in session.query(FreightOrder.order_id, FreightOrder.source_key).all()
        if sk
    }

    fo_stops = movement_dir / "normal_planning_freight_order_stops.csv"
    if fo_stops.exists() and fo_key_to_id:
        df = _normalize_columns(pd.read_csv(fo_stops, sep=";", encoding="utf-8", on_bad_lines="warn"))
        loc_col = _pick_column(df, "LOCATION")
        if loc_col:
            codes = set(df[loc_col].dropna().astype(str).str.strip())
            addr_map = _ensure_addresses(session, codes)
        else:
            addr_map = {}
        records = []
        for _, r in df.iterrows():
            parent = str(r.get("PARENT_KEY", "")).strip()
            order_id = fo_key_to_id.get(parent)
            if not order_id:
                continue
            loc = str(r.get(loc_col, "")).strip() if loc_col else ""
            addr_id = addr_map.get(loc)
            if not addr_id:
                continue
            stop_cat = str(r.get("STOP CATEGORY", "")).strip().upper()
            stop_type = "Outbound" if stop_cat == "O" else "Inbound" if stop_cat == "I" else None
            seq = pd.to_numeric(r.get("STOP"), errors="coerce")
            if not stop_type or pd.isna(seq):
                continue
            records.append(
                {
                    "order_id": order_id,
                    "address_id": addr_id,
                    "stop_type": stop_type,
                    "sequence_number": int(seq),
                    "source_key": str(r.get("KEY", "")).strip() or None,
                    "parent_source_key": parent or None,
                }
            )
        if records:
            summary["freight_order_stops"] = _bulk_insert(session, FreightOrderStop, pd.DataFrame(records))

    fo_stop_key_to_id = {
        sk: sid
        for sid, sk in session.query(FreightOrderStop.stop_id, FreightOrderStop.source_key).all()
        if sk
    }

    fo_stages = movement_dir / "normal_planning_freight_order_stages.csv"
    if fo_stages.exists() and fo_key_to_id and fo_stop_key_to_id:
        df = _normalize_columns(pd.read_csv(fo_stages, sep=";", encoding="utf-8", on_bad_lines="warn"))
        records = []
        for _, r in df.iterrows():
            parent = str(r.get("PARENT_KEY", "")).strip()
            order_id = fo_key_to_id.get(parent)
            if not order_id:
                continue
            from_key = str(r.get("ROOT_KEY", "")).strip()
            to_key = str(r.get("TO STOP KEY", "")).strip()
            from_id = fo_stop_key_to_id.get(from_key)
            to_id = fo_stop_key_to_id.get(to_key)
            if not from_id or not to_id:
                continue
            records.append(
                {
                    "order_id": order_id,
                    "from_stop_id": from_id,
                    "to_stop_id": to_id,
                    "distance": _parse_distance_km(r.get("DECIMAL VALUE")),
                    "duration": _parse_hhmm_to_minutes(r.get("DURATION")),
                    "source_key": str(r.get("KEY", "")).strip() or None,
                    "parent_source_key": parent or None,
                    "from_stop_source_key": from_key or None,
                    "to_stop_source_key": to_key or None,
                }
            )
        if records:
            summary["freight_order_stages"] = _bulk_insert(session, FreightOrderStage, pd.DataFrame(records))

    return summary


def _apply_mapping(
    df: pd.DataFrame,
    mapping: TableMapping,
) -> pd.DataFrame:
    """Rename CSV columns to DB columns, keep only mapped ones."""
    df = _normalize_columns(df)

    available = set(df.columns) & set(mapping.column_map.keys())
    missing = set(mapping.column_map.keys()) - set(df.columns)
    if missing:
        logger.warning(
            "%s: CSV missing columns %s — they will be NULL",
            mapping.filename,
            missing,
        )

    rename = {k: v for k, v in mapping.column_map.items() if k in available}
    df = df[list(rename.keys())].rename(columns=rename)

    for col in mapping.date_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df


def _bulk_insert(session: Session, model: type, df: pd.DataFrame) -> int:
    """Insert DataFrame rows into the DB in batches. Returns row count."""
    records = df.to_dict(orient="records")
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        session.bulk_insert_mappings(model, batch)
        session.flush()
        total += len(batch)
    return total


def load_single(
    data_dir: Path,
    mapping: TableMapping,
    session: Session,
) -> int:
    csv_path = _resolve_csv_path(data_dir, mapping)
    if csv_path is None:
        logger.warning("File not found, skipping: %s", mapping.filename)
        return 0

    logger.info("Loading %s → %s", csv_path.name, mapping.model.__tablename__)
    df = pd.read_csv(csv_path, sep=mapping.sep, encoding="utf-8", on_bad_lines="warn")
    df = _apply_mapping(df, mapping)
    if mapping.model in (Vehicle, VehicleAttributes) and "transport_type_id" in df.columns:
        code_to_id = _get_transport_type_code_to_id(session)
        df["transport_type_id"] = df["transport_type_id"].astype(str).str.strip().map(code_to_id)
        before = len(df)
        df = df.dropna(subset=["transport_type_id"]).astype({"transport_type_id": "int64"})
        if before > len(df):
            logger.warning("  Dropped %d rows with unknown transport type code", before - len(df))
        if mapping.model is VehicleAttributes:
            df = df.drop_duplicates(subset=["transport_type_id"], keep="first")
    count = _bulk_insert(session, mapping.model, df)
    logger.info("  Inserted %d rows into %s", count, mapping.model.__tablename__)
    return count


def _truncate_all(session: Session) -> None:
    tables = [
        "freight_order_stages",
        "freight_order_items",
        "freight_order_stops",
        "freight_orders",
        "freight_unit_stops",
        "freight_units",
        "vehicle_attributes",
        "vehicles",
        "transport_types",
        "addresses",
    ]
    quoted = ", ".join(f'"{t}"' for t in tables)
    session.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
    logger.info("Truncated all GreenTrack tables")


def load_all(data_dir: str | Path, replace: bool = False) -> dict[str, int]:
    """
    Load all CSV files from data_dir into the database.
    If replace=True, truncate all tables first (idempotent re-ingest).
    """
    data_dir = Path(data_dir)
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Data directory does not exist: {data_dir}")

    summary: dict[str, int] = {}
    session = SessionLocal()

    try:
        if replace:
            _truncate_all(session)
            session.flush()
        for mapping in LOAD_ORDER:
            count = load_single(data_dir, mapping, session)
            summary[mapping.model.__tablename__] = count

        movement_summary = _load_movement(data_dir, session)
        summary.update(movement_summary)

        session.commit()
        logger.info("All CSV files committed successfully")
    except Exception:
        session.rollback()
        logger.exception("Ingestion failed — transaction rolled back")
        raise
    finally:
        session.close()

    return summary
