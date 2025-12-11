from fastapi import FastAPI
from .routers import cars  # later: branches, rentals, telemetry, etc.

app = FastAPI(
    title="Car Rental BI Platform API",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(cars.router, prefix="/api/v1")
