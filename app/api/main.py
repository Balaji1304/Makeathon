import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import alerts, dashboard, fleet, orders, routes, simulation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="GreenTrack Control Tower API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to frontend URL for Prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(fleet.router, prefix="/api/fleet", tags=["fleet"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(routes.router, prefix="/api/routes", tags=["routes"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(simulation.router, prefix="/api/simulate", tags=["simulation"])

@app.get("/api/health")
async def health() -> dict:
    logger.info("Health check")
    return {"status": "ok"}

