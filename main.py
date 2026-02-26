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

    else:
        print(
            "Usage:\n"
            "  python main.py init-db [--reset]              Create tables (or drop+recreate)\n"
            "  python main.py ingest [data_dir] [--replace]  Load CSVs (--replace truncates first)\n"
            "  python main.py build-facts                    Build transport_stage_fact and views\n"
            "  python main.py analytics-report               Print key analytics KPIs\n"
        )


if __name__ == "__main__":
    main()
