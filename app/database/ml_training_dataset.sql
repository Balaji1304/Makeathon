-- Materialized view for ML training: transport_stage_fact + vehicle/type attributes.
-- Do NOT auto-run; apply manually when needed.

DROP MATERIALIZED VIEW IF EXISTS ml_training_dataset;

CREATE MATERIALIZED VIEW ml_training_dataset AS
SELECT
    tsf.id,
    tsf.order_id,
    tsf.vehicle_id,
    tsf.transport_type,
    tsf.from_stop_id,
    tsf.to_stop_id,
    tsf.distance_km,
    tsf.duration_min,
    tsf.total_weight_kg AS load_weight_kg,
    tsf.vehicle_capacity_kg,
    tsf.load_ratio,
    tsf.co2_kg,
    tsf.created_at,
    tt.name AS transport_type_name,
    va.capacity_kg AS type_capacity_kg,
    va.co2_empty_kg_km,
    va.co2_loaded_kg_km
FROM transport_stage_fact tsf
LEFT JOIN vehicles v ON v.vehicle_id = tsf.vehicle_id
LEFT JOIN transport_types tt ON tt.transport_type_id = v.transport_type_id
LEFT JOIN vehicle_attributes va ON va.transport_type_id = v.transport_type_id;

CREATE UNIQUE INDEX ON ml_training_dataset (id);
