import logging
import sys
from pathlib import Path

from app.database.connection import init_db, reset_db, SessionLocal
from app.ingestion.csv_loader import load_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_DATA_DIR = Path(__file__).parent / "data" / "raw"


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "help"

    if command == "init-db":
        reset = "--reset" in sys.argv or "-R" in sys.argv
        if reset:
            reset_db()
        else:
            init_db()
        logger.info("Database initialized")

    elif command == "ingest":
        args = sys.argv[2:]
        replace = "--replace" in args or "-r" in args
        data_dir = next((Path(a) for a in args if not a.startswith("-")), DEFAULT_DATA_DIR)
        init_db()
        summary = load_all(data_dir, replace=replace)
        for table, count in summary.items():
            logger.info("  %-30s %d rows", table, count)

    elif command == "build-facts":
        init_db()
        from app.analytics.fact_builder import (
            build_transport_stage_fact,
            ensure_materialized_views,
            refresh_materialized_views,
        )

        session = SessionLocal()
        try:
            inserted = build_transport_stage_fact(session)
            ensure_materialized_views(session)
            refresh_materialized_views(session)
            session.commit()
            logger.info("Fact build complete with %d rows", inserted)
        except Exception:
            session.rollback()
            logger.exception("Failed to build transport_stage_fact")
            raise
        finally:
            session.close()

    elif command == "analytics-report":
        init_db()
        from sqlalchemy import func
        from app.database.models import TransportStageFact
        from app.analytics.utilization import (
            find_underutilized_vehicles,
            high_emission_routes,
        )

        session = SessionLocal()
        try:
            total_co2 = (
                session.query(func.sum(TransportStageFact.co2_kg)).scalar() or 0.0
            )
            avg_load = (
                session.query(func.avg(TransportStageFact.load_ratio)).scalar() or 0.0
            )
            underutilized = find_underutilized_vehicles(session)
            worst_routes = high_emission_routes(session, top_n=5)

            print(f"Total CO₂ emissions: {total_co2:.2f} kg")
            print(f"Average fleet load ratio: {avg_load:.2%}")
            print("Worst 5 routes by CO₂:")
            for r in worst_routes:
                print(
                    f"  Order {r.order_id}: {r.total_co2:.2f} kg CO₂ over {r.total_distance_km:.1f} km"
                )
            print(
                f"Underutilized vehicles below 50% load: {len(underutilized)} (potential optimization targets)"
            )
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("Failed to generate analytics report")
            raise
        finally:
            session.close()

    elif command == "train-models":
        init_db()
        from app.ml.training import run_training
        cache_dir = Path(__file__).parent / "data" / "ml_cache"
        cache_path = cache_dir / "ml_dataset.parquet"
        try:
            result = run_training(session=None, cache_path=cache_path, use_cache=False)
            logger.info("Models saved: %s, %s", result["emission_path"], result["load_path"])
        except Exception:
            logger.exception("Training failed")
            raise

    elif command == "simulate":
        init_db()
        args = sys.argv[2:]
        order_id = None
        for i, a in enumerate(args):
            if a in ("--order", "-o") and i + 1 < len(args):
                try:
                    order_id = int(args[i + 1])
                    break
                except ValueError:
                    pass
        alt_type = "Truck"
        for i, a in enumerate(args):
            if a == "--vehicle-type" and i + 1 < len(args):
                alt_type = args[i + 1]
                break
        if order_id is None:
            logger.error("Usage: python main.py simulate --order <order_id> [--vehicle-type <type>]")
            sys.exit(1)
        from app.ml.simulator import simulate_order
        session = SessionLocal()
        try:
            out = simulate_order(session, order_id, alt_type)
            if out.get("error"):
                logger.warning(out["error"])
                if out.get("available_types"):
                    print("Available vehicle types:", ", ".join(out["available_types"]))
            else:
                print(f"Order {out['order_id']}: current CO2 {out['current_predicted_co2']:.2f} kg, "
                      f"alternative {out['alternative_predicted_co2']:.2f} kg, "
                      f"CO2 savings {out['co2_savings_percent']:.1f}%, "
                      f"utilization change {out['utilization_improvement']:+.3f}")
        finally:
            session.close()

    else:
        print(
            "Usage:\n"
            "  python main.py init-db [--reset]              Create tables (or drop+recreate)\n"
            "  python main.py ingest [data_dir] [--replace]  Load CSVs (--replace truncates first)\n"
            "  python main.py build-facts                    Build transport_stage_fact and views\n"
            "  python main.py analytics-report               Print key analytics KPIs\n"
            "  python main.py train-models                   Train emission and load ML models\n"
            "  python main.py simulate --order <id> [--vehicle-type <type>]  What-if simulation\n"
        )


if __name__ == "__main__":
    main()
