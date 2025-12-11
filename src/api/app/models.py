from sqlalchemy import (
    Column, Integer, String, TIMESTAMP, ForeignKey, Numeric
)
from sqlalchemy.orm import relationship
from .db import Base

class Branch(Base):
    __tablename__ = "BRANCHES"

    branch_id = Column("BRANCH_ID", Integer, primary_key=True)
    branch_name = Column("BRANCH_NAME", String(100), nullable=False)
    address = Column("ADDRESS", String(200))
    city = Column("CITY", String(100), nullable=False)
    phone = Column("PHONE", String(30))
    email = Column("EMAIL", String(100))
    created_at = Column("CREATED_AT", TIMESTAMP)

    cars = relationship("Car", back_populates="branch")

class Car(Base):
    __tablename__ = "CARS"

    car_id = Column("CAR_ID", Integer, primary_key=True)
    category_id = Column("CATEGORY_ID", Integer, nullable=False)
    device_id = Column("DEVICE_ID", Integer)
    vin = Column("VIN", String(30), nullable=False)
    license_plate = Column("LICENSE_PLATE", String(20), nullable=False)
    make = Column("MAKE", String(60), nullable=False)
    model = Column("MODEL", String(60), nullable=False)
    model_year = Column("MODEL_YEAR", Integer)
    color = Column("COLOR", String(40))
    odometer_km = Column("ODOMETER_KM", Integer)
    status = Column("STATUS", String(20))
    branch_id = Column("BRANCH_ID", Integer, ForeignKey("BRANCHES.BRANCH_ID"))
    created_at = Column("CREATED_AT", TIMESTAMP)

    branch = relationship("Branch", back_populates="cars")
