import logging
from typing import List

from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.schemas import AlertRecommendation
from app.recommendation.engine import generate_recommendations

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/recommendations", response_model=List[AlertRecommendation])
def get_alert_recommendations(db: DbSession) -> List[AlertRecommendation]:
    logger.info("GET /alerts/recommendations")

    recs = generate_recommendations(db)
    out: list[AlertRecommendation] = []
    for r in recs:
        recommendation_text = r.get("recommendation", "")
        alert_type = recommendation_text.split(";")[0].strip() if recommendation_text else "optimization"
        out.append(
            AlertRecommendation(
                order_id=int(r["order_id"]),
                alert_type=alert_type,
                explanation=recommendation_text,
                estimated_co2_reduction=float(r.get("estimated_co2_reduction", 0.0)),
                priority_score=float(r.get("priority_score", 0.0)),
            )
        )
    return out

