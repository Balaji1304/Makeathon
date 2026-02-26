from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


# ── Master Data ──────────────────────────────────────────────


class Address(Base):
    __tablename__ = "addresses"

    address_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_code: Mapped[Optional[str]] = mapped_column(String, unique=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    street: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(128))
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    country: Mapped[Optional[str]] = mapped_column(String(64))
    latitude: Mapped[Optional[float]] = mapped_column(Double)
    longitude: Mapped[Optional[float]] = mapped_column(Double)

    __table_args__ = (
        Index("idx_addresses_city", "city"),
        Index("idx_addresses_external_code", "external_code"),
    )


class TransportType(Base):
    __tablename__ = "transport_types"

    transport_type_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="transport_type")
    attributes: Mapped[Optional["VehicleAttributes"]] = relationship(
        back_populates="transport_type", uselist=False
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transport_type_id: Mapped[int] = mapped_column(
        ForeignKey("transport_types.transport_type_id"), nullable=False
    )
    license_plate: Mapped[Optional[str]] = mapped_column(String(32), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    transport_type: Mapped["TransportType"] = relationship(back_populates="vehicles")
    freight_orders: Mapped[list["FreightOrder"]] = relationship(
        back_populates="vehicle"
    )

    __table_args__ = (Index("idx_vehicles_type", "transport_type_id"),)


class VehicleAttributes(Base):
    __tablename__ = "vehicle_attributes"

    attribute_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transport_type_id: Mapped[int] = mapped_column(
        ForeignKey("transport_types.transport_type_id"), unique=True, nullable=False
    )
    capacity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    capacity_volume: Mapped[Optional[float]] = mapped_column(Double)
    co2_empty_kg_km: Mapped[float] = mapped_column(Double, nullable=False)
    co2_loaded_kg_km: Mapped[float] = mapped_column(Double, nullable=False)

    transport_type: Mapped["TransportType"] = relationship(back_populates="attributes")


# ── Freight Units ────────────────────────────────────────────


class FreightUnit(Base):
    __tablename__ = "freight_units"

    unit_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[Optional[str]] = mapped_column(String, unique=True)
    weight: Mapped[Optional[float]] = mapped_column(Double)
    volume: Mapped[Optional[float]] = mapped_column(Double)
    direct_distance: Mapped[Optional[float]] = mapped_column(Double)
    estimated_duration: Mapped[Optional[float]] = mapped_column(Double)
    planned_date: Mapped[Optional[date]] = mapped_column(Date)

    stops: Mapped[list["FreightUnitStop"]] = relationship(back_populates="freight_unit")
    order_items: Mapped[list["FreightOrderItem"]] = relationship(
        back_populates="freight_unit"
    )


class FreightUnitStop(Base):
    __tablename__ = "freight_unit_stops"

    stop_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    unit_id: Mapped[int] = mapped_column(
        ForeignKey("freight_units.unit_id"), nullable=False
    )
    address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.address_id"), nullable=False
    )
    source_key: Mapped[Optional[str]] = mapped_column(String)
    parent_source_key: Mapped[Optional[str]] = mapped_column(String)
    stop_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)

    freight_unit: Mapped["FreightUnit"] = relationship(back_populates="stops")
    address: Mapped["Address"] = relationship()

    __table_args__ = (
        CheckConstraint("stop_type IN ('Outbound', 'Inbound')", name="ck_fu_stop_type"),
        Index("idx_fu_stops_unit", "unit_id"),
        Index("idx_fu_stops_source_key", "source_key"),
    )


# ── Freight Orders ───────────────────────────────────────────


class FreightOrder(Base):
    __tablename__ = "freight_orders"

    order_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_key: Mapped[Optional[str]] = mapped_column(String, unique=True)
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.vehicle_id"), nullable=False
    )
    total_weight: Mapped[Optional[float]] = mapped_column(Double)
    total_volume: Mapped[Optional[float]] = mapped_column(Double)
    total_distance: Mapped[Optional[float]] = mapped_column(Double)
    total_duration: Mapped[Optional[float]] = mapped_column(Double)
    planned_date: Mapped[Optional[date]] = mapped_column(Date)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="freight_orders")
    items: Mapped[list["FreightOrderItem"]] = relationship(back_populates="freight_order")
    stops: Mapped[list["FreightOrderStop"]] = relationship(back_populates="freight_order")
    stages: Mapped[list["FreightOrderStage"]] = relationship(
        back_populates="freight_order"
    )

    __table_args__ = (
        Index("idx_freight_orders_vehicle", "vehicle_id"),
        Index("idx_freight_orders_date", "planned_date"),
        Index("idx_freight_orders_source_key", "source_key"),
    )


class FreightOrderItem(Base):
    __tablename__ = "freight_order_items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("freight_orders.order_id"), nullable=False
    )
    unit_id: Mapped[int] = mapped_column(
        ForeignKey("freight_units.unit_id"), nullable=False
    )
    source_key: Mapped[Optional[str]] = mapped_column(String)
    parent_source_key: Mapped[Optional[str]] = mapped_column(String)
    weight: Mapped[Optional[float]] = mapped_column(Double)
    volume: Mapped[Optional[float]] = mapped_column(Double)

    freight_order: Mapped["FreightOrder"] = relationship(back_populates="items")
    freight_unit: Mapped["FreightUnit"] = relationship(back_populates="order_items")

    __table_args__ = (
        Index("idx_fo_items_order", "order_id"),
        Index("idx_fo_items_source_key", "source_key"),
    )


class FreightOrderStop(Base):
    __tablename__ = "freight_order_stops"

    stop_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("freight_orders.order_id"), nullable=False
    )
    address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.address_id"), nullable=False
    )
    source_key: Mapped[Optional[str]] = mapped_column(String)
    parent_source_key: Mapped[Optional[str]] = mapped_column(String)
    stop_type: Mapped[Optional[str]] = mapped_column(String(16))
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    arrival_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    freight_order: Mapped["FreightOrder"] = relationship(back_populates="stops")
    address: Mapped["Address"] = relationship()

    __table_args__ = (
        Index("idx_fo_stops_order", "order_id"),
        Index("idx_fo_stops_source_key", "source_key"),
    )


class FreightOrderStage(Base):
    __tablename__ = "freight_order_stages"

    stage_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("freight_orders.order_id"), nullable=False
    )
    from_stop_id: Mapped[int] = mapped_column(
        ForeignKey("freight_order_stops.stop_id"), nullable=False
    )
    to_stop_id: Mapped[int] = mapped_column(
        ForeignKey("freight_order_stops.stop_id"), nullable=False
    )
    source_key: Mapped[Optional[str]] = mapped_column(String)
    parent_source_key: Mapped[Optional[str]] = mapped_column(String)
    from_stop_source_key: Mapped[Optional[str]] = mapped_column(String)
    to_stop_source_key: Mapped[Optional[str]] = mapped_column(String)
    distance: Mapped[Optional[float]] = mapped_column(Double)
    duration: Mapped[Optional[float]] = mapped_column(Double)

    freight_order: Mapped["FreightOrder"] = relationship(back_populates="stages")
    from_stop: Mapped["FreightOrderStop"] = relationship(foreign_keys=[from_stop_id])
    to_stop: Mapped["FreightOrderStop"] = relationship(foreign_keys=[to_stop_id])

    __table_args__ = (
        Index("idx_fo_stages_order", "order_id"),
        Index("idx_fo_stages_source_key", "source_key"),
    )


class TransportStageFact(Base):
    __tablename__ = "transport_stage_fact"

    id: Mapped[uuid4] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    order_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    vehicle_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    transport_type: Mapped[Optional[str]] = mapped_column(String, index=True)
    from_stop_id: Mapped[Optional[int]] = mapped_column(Integer)
    to_stop_id: Mapped[Optional[int]] = mapped_column(Integer)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric)
    duration_min: Mapped[Optional[float]] = mapped_column(Numeric)
    total_weight_kg: Mapped[Optional[float]] = mapped_column(Numeric)
    vehicle_capacity_kg: Mapped[Optional[float]] = mapped_column(Numeric)
    load_ratio: Mapped[Optional[float]] = mapped_column(Numeric)
    co2_kg: Mapped[Optional[float]] = mapped_column(Numeric)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

