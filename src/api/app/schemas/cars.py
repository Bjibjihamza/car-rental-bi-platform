from datetime import datetime
from pydantic import BaseModel

class CarBase(BaseModel):
    category_id: int
    device_id: int | None = None
    vin: str
    license_plate: str
    make: str
    model: str
    model_year: int | None = None
    color: str | None = None
    odometer_km: int | None = 0
    status: str | None = "AVAILABLE"
    branch_id: int | None = None

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    status: str | None = None
    branch_id: int | None = None
    odometer_km: int | None = None

class CarOut(CarBase):
    car_id: int
    created_at: datetime | None

    class Config:
        from_attributes = True   # Pydantic v2 (replaces orm_mode=True)
