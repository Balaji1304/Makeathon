import logging

import streamlit as st

from app.db.connection import SessionLocal
from app.services.analytics_service import (
    get_stage_facts,
    get_vehicle_summary,
    get_order_summary,
)
from app.services.optimization_service import get_kpi_candidates
from app.optimization.consolidation import detect_low_load_consolidation


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def load_data():
    session = SessionLocal()
    try:
        df_facts = get_stage_facts(session)
        df_veh = get_vehicle_summary(session)
        df_ord = get_order_summary(session)
    finally:
        session.close()
    return df_facts, df_veh, df_ord


def main() -> None:
    st.set_page_config(page_title="GreenTrack Dashboard", layout="wide")
    st.title("GreenTrack — Logistics Analytics")

    df_facts, df_veh, df_ord = load_data()

    if df_facts.empty:
        st.warning("No facts found. Run `python main.py build-facts` first.")
        return

    total_co2 = df_facts["co2_kg"].sum()
    total_distance = df_facts["distance_km"].sum()
    avg_load = df_facts["load_ratio"].mean()

    c1, c2, c3 = st.columns(3)
    c1.metric("Total CO₂ (kg)", f"{total_co2:,.0f}")
    c2.metric("Total Distance (km)", f"{total_distance:,.0f}")
    c3.metric("Average Load Ratio", f"{avg_load:,.0%}")

    tab_overview, tab_vehicles, tab_routes, tab_opt = st.tabs(
        ["Overview", "Vehicles", "Routes", "Optimization"]
    )

    with tab_overview:
        st.subheader("Distance vs. CO₂ by Order")
        if not df_ord.empty:
            st.dataframe(df_ord.sort_values("total_co2_kg", ascending=False).head(20))
        st.subheader("Stage Facts (sample)")
        st.dataframe(df_facts.head(50))

    with tab_vehicles:
        st.subheader("Fleet Utilization")
        if not df_veh.empty:
            st.dataframe(df_veh)
            st.bar_chart(
                df_veh.set_index("vehicle_id")[["avg_load_ratio"]],
            )

    with tab_routes:
        st.subheader("High Emission Routes")
        if not df_ord.empty:
            st.dataframe(
                df_ord.sort_values("total_co2_kg", ascending=False).head(20)
            )

    with tab_opt:
        st.subheader("Optimization Candidates")
        weights_col1, weights_col2, weights_col3 = st.columns(3)
        low_load_weight = weights_col1.number_input(
            "Low-load weight", value=1.0, min_value=0.0
        )
        distance_weight = weights_col2.number_input(
            "Distance weight", value=0.01, min_value=0.0
        )
        emission_weight = weights_col3.number_input(
            "Emission weight", value=0.02, min_value=0.0
        )

        session = SessionLocal()
        try:
            weights = {
                "low_load_weight": low_load_weight,
                "distance_weight": distance_weight,
                "emission_weight": emission_weight,
            }
            df_top = get_kpi_candidates(session, weights, top_n=20)
        finally:
            session.close()

        if not df_top.empty:
            st.markdown("**Top optimization candidates (by stage):**")
            st.dataframe(df_top)

        st.subheader("Low-load consolidation opportunities")
        cons = detect_low_load_consolidation(df_facts)
        st.write(f"Detected {len(cons)} candidate order pairs.")
        if cons:
            st.dataframe(
                [
                    {
                        "order_a": c.order_ids[0],
                        "order_b": c.order_ids[1],
                        "avg_load_ratio": c.avg_load_ratio,
                        "combined_distance_km": c.combined_distance_km,
                    }
                    for c in cons[:50]
                ]
            )


if __name__ == "__main__":
    main()

