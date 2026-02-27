import logging

from fastapi import APIRouter
from sqlalchemy import distinct, func

from app.api.deps import DbSession
from app.api.schemas import DashboardSummary
from app.database.models import TransportStageFact

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: DbSession) -> DashboardSummary:
    logger.info("GET /dashboard/summary")

    total_co2, total_distance, avg_load, order_count = (
        db.query(
            func.coalesce(func.sum(TransportStageFact.co2_kg), 0.0),
            func.coalesce(func.sum(TransportStageFact.distance_km), 0.0),
            func.coalesce(func.avg(TransportStageFact.load_ratio), 0.0),
            func.count(distinct(TransportStageFact.order_id)),
        )
        .select_from(TransportStageFact)
        .one()
    )

    avg_load_value = float(avg_load or 0.0)
    total_co2_value = float(total_co2 or 0.0)

    # Simple potential savings proxy based on under‑utilization.
    utilization_gap = max(0.0, min(1.0, 0.8 - avg_load_value))
    estimated_savings = total_co2_value * utilization_gap

    return DashboardSummary(
        total_co2_emission=total_co2_value,
        total_distance_km=float(total_distance or 0.0),
        average_load_ratio=avg_load_value,
        number_of_orders=int(order_count or 0),
        estimated_co2_savings=estimated_savings,
    )

