from app.db.connection import SessionLocal
from app.services.analytics_service import (
    get_stage_facts,
    get_vehicle_summary,
    get_order_summary,
)
from app.services.optimization_service import get_kpi_candidates
from app.optimization.consolidation import detect_low_load_consolidation
from app.optimization.simulation import simulate_vehicle_change, compare_scenarios


def main() -> None:
    session = SessionLocal()
    try:
        df_facts = get_stage_facts(session)
        print("facts", df_facts.shape)
        df_veh = get_vehicle_summary(session)
        print("veh", df_veh.shape)
        df_ord = get_order_summary(session)
        print("ord", df_ord.shape)

        weights = {
            "low_load_weight": 1.0,
            "distance_weight": 0.01,
            "emission_weight": 0.02,
        }
        top = get_kpi_candidates(session, weights, top_n=5)
        print("top_candidates")
        print(top)

        cons = detect_low_load_consolidation(df_facts, load_threshold=0.4)
        print("consolidation_candidates", len(cons))

        mapping: dict[int, str] = {}
        if not df_facts.empty:
            vid = int(df_facts["vehicle_id"].iloc[0])
            mapping[vid] = "ZFT005"
        df_after = simulate_vehicle_change(df_facts, mapping)
        res = compare_scenarios(df_facts, df_after)
        print("scenario", res)
    finally:
        session.close()


if __name__ == "__main__":
    main()

