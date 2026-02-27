import logging

from fastapi import FastAPI

from app.api.routes import alerts, dashboard, fleet, orders, routes, simulation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="GreenTrack Control Tower API", version="1.0.0")

app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(fleet.router, prefix="/fleet", tags=["fleet"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(simulation.router, prefix="/simulate", tags=["simulation"])


@app.get("/health")
async def health() -> dict:
    logger.info("Health check")
    return {"status": "ok"}

