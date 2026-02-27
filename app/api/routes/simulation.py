import logging

from fastapi import APIRouter, HTTPException

from app.api.deps import DbSession
from app.api.schemas import SimulationRequest, SimulationResponse
from app.ml.simulator import simulate_order

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=SimulationResponse)
def run_simulation(payload: SimulationRequest, db: DbSession) -> SimulationResponse:
    logger.info("POST /simulate for order %s", payload.order_id)

    result = simulate_order(
        session=db,
        order_id=payload.order_id,
        alternative_vehicle_type=payload.vehicle_type,
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    recommendation_parts = []
    if result.get("co2_savings_percent", 0.0) > 5.0:
        recommendation_parts.append("Switching vehicle type is recommended to reduce CO₂.")
    if result.get("utilization_improvement", 0.0) > 0.05:
        recommendation_parts.append("Utilization is expected to improve.")
    if not recommendation_parts:
        recommendation_parts.append("Scenario has limited improvement potential.")

    return SimulationResponse(
        order_id=result["order_id"],
        vehicle_type=payload.vehicle_type,
        predicted_co2=float(result["alternative_predicted_co2"]),
        savings_percentage=float(result["co2_savings_percent"]),
        utilization_change=float(result["utilization_improvement"]),
        recommendation_text=" ".join(recommendation_parts),
    )

