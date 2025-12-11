from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..schemas.cars import CarOut, CarCreate, CarUpdate

router = APIRouter(prefix="/cars", tags=["cars"])

@router.get("/", response_model=List[CarOut])
def list_cars(
    status: str | None = Query(default=None),
    branch_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Car)
    if status:
        query = query.filter(models.Car.status == status)
    if branch_id:
        query = query.filter(models.Car.branch_id == branch_id)
    return query.all()

@router.get("/{car_id}", response_model=CarOut)
def get_car(car_id: int, db: Session = Depends(get_db)):
    car = db.query(models.Car).get(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car

@router.post("/", response_model=CarOut, status_code=201)
def create_car(payload: CarCreate, db: Session = Depends(get_db)):
    car = models.Car(**payload.model_dump())
    db.add(car)
    db.commit()
    db.refresh(car)
    return car

@router.patch("/{car_id}", response_model=CarOut)
def update_car(car_id: int, payload: CarUpdate, db: Session = Depends(get_db)):
    car = db.query(models.Car).get(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(car, field, value)

    db.commit()
    db.refresh(car)
    return car
