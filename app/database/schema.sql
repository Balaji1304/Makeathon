-- GreenTrack — PostgreSQL Schema
-- Run once: psql -U greentrack_user -d greentrack -f schema.sql

BEGIN;

-- ============================================================
-- MASTER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
    address_id    SERIAL PRIMARY KEY,
    external_code TEXT UNIQUE,
    name          VARCHAR(255),
    street        VARCHAR(255),
    city          VARCHAR(128),
    postal_code   VARCHAR(20),
    country       VARCHAR(64),
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION
);

CREATE INDEX idx_addresses_city ON addresses (city);
CREATE INDEX idx_addresses_external_code ON addresses (external_code);

CREATE TABLE IF NOT EXISTS transport_types (
    transport_type_id  SERIAL PRIMARY KEY,
    name               VARCHAR(128) NOT NULL UNIQUE,
    description        TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id         SERIAL PRIMARY KEY,
    transport_type_id  INTEGER NOT NULL REFERENCES transport_types (transport_type_id),
    license_plate      VARCHAR(32) UNIQUE,
    is_active          BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_vehicles_type ON vehicles (transport_type_id);

CREATE TABLE IF NOT EXISTS vehicle_attributes (
    attribute_id       SERIAL PRIMARY KEY,
    transport_type_id  INTEGER NOT NULL UNIQUE REFERENCES transport_types (transport_type_id),
    capacity_kg        DOUBLE PRECISION NOT NULL,
    capacity_volume    DOUBLE PRECISION,
    co2_empty_kg_km    DOUBLE PRECISION NOT NULL,
    co2_loaded_kg_km   DOUBLE PRECISION NOT NULL
);

-- ============================================================
-- FREIGHT UNITS (customer orders before tour planning)
-- ============================================================

CREATE TABLE IF NOT EXISTS freight_units (
    unit_id             SERIAL PRIMARY KEY,
    source_key          TEXT UNIQUE,
    weight              DOUBLE PRECISION,
    volume              DOUBLE PRECISION,
    direct_distance     DOUBLE PRECISION,
    estimated_duration  DOUBLE PRECISION,
    planned_date        DATE
);

CREATE TABLE IF NOT EXISTS freight_unit_stops (
    stop_id         SERIAL PRIMARY KEY,
    unit_id         INTEGER NOT NULL REFERENCES freight_units (unit_id),
    address_id      INTEGER NOT NULL REFERENCES addresses (address_id),
    source_key      TEXT,
    parent_source_key TEXT,
    stop_type       VARCHAR(16) NOT NULL CHECK (stop_type IN ('Outbound', 'Inbound')),
    sequence_number INTEGER NOT NULL
);

CREATE INDEX idx_fu_stops_unit ON freight_unit_stops (unit_id);
CREATE INDEX idx_fu_stops_source_key ON freight_unit_stops (source_key);

-- ============================================================
-- FREIGHT ORDERS (planned tours / routes)
-- ============================================================

CREATE TABLE IF NOT EXISTS freight_orders (
    order_id        SERIAL PRIMARY KEY,
    source_key      TEXT UNIQUE,
    vehicle_id      INTEGER NOT NULL REFERENCES vehicles (vehicle_id),
    total_weight    DOUBLE PRECISION,
    total_volume    DOUBLE PRECISION,
    total_distance  DOUBLE PRECISION,
    total_duration  DOUBLE PRECISION,
    planned_date    DATE
);

CREATE INDEX idx_freight_orders_vehicle ON freight_orders (vehicle_id);
CREATE INDEX idx_freight_orders_date    ON freight_orders (planned_date);
CREATE INDEX idx_freight_orders_source_key ON freight_orders (source_key);

CREATE TABLE IF NOT EXISTS freight_order_items (
    item_id    SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES freight_orders (order_id),
    unit_id    INTEGER NOT NULL REFERENCES freight_units (unit_id),
    source_key TEXT,
    parent_source_key TEXT,
    weight     DOUBLE PRECISION,
    volume     DOUBLE PRECISION
);

CREATE INDEX idx_fo_items_order ON freight_order_items (order_id);
CREATE INDEX idx_fo_items_source_key ON freight_order_items (source_key);

CREATE TABLE IF NOT EXISTS freight_order_stops (
    stop_id          SERIAL PRIMARY KEY,
    order_id         INTEGER NOT NULL REFERENCES freight_orders (order_id),
    address_id       INTEGER NOT NULL REFERENCES addresses (address_id),
    source_key       TEXT,
    parent_source_key TEXT,
    stop_type        VARCHAR(16),
    sequence_number  INTEGER NOT NULL,
    arrival_time     TIMESTAMP
);

CREATE INDEX idx_fo_stops_order ON freight_order_stops (order_id);
CREATE INDEX idx_fo_stops_source_key ON freight_order_stops (source_key);

CREATE TABLE IF NOT EXISTS freight_order_stages (
    stage_id      SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES freight_orders (order_id),
    from_stop_id  INTEGER NOT NULL REFERENCES freight_order_stops (stop_id),
    to_stop_id    INTEGER NOT NULL REFERENCES freight_order_stops (stop_id),
    source_key    TEXT,
    parent_source_key TEXT,
    from_stop_source_key TEXT,
    to_stop_source_key TEXT,
    distance      DOUBLE PRECISION,
    duration      DOUBLE PRECISION
);

CREATE INDEX idx_fo_stages_order ON freight_order_stages (order_id);

-- ============================================================
-- ANALYTICS FACT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS transport_stage_fact (
    id UUID PRIMARY KEY,
    order_id        INTEGER,
    vehicle_id      INTEGER,
    transport_type  TEXT,
    from_stop_id    INTEGER,
    to_stop_id      INTEGER,
    distance_km     NUMERIC,
    duration_min    NUMERIC,
    total_weight_kg NUMERIC,
    vehicle_capacity_kg NUMERIC,
    load_ratio      NUMERIC,
    co2_kg          NUMERIC,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsf_order_id ON transport_stage_fact (order_id);
CREATE INDEX IF NOT EXISTS idx_tsf_vehicle_id ON transport_stage_fact (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tsf_transport_type ON transport_stage_fact (transport_type);
CREATE INDEX idx_fo_stages_source_key ON freight_order_stages (source_key);

COMMIT;
