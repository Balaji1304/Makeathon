-- Run once as postgres. Replace DB_NAME and DB_USER if you use different .env values.
-- Fixes: permission denied for schema public (PostgreSQL 15+)
-- Example: psql -U postgres -d greentrack -f scripts/grant_public_schema.sql
GRANT ALL ON SCHEMA public TO greentrack_user;
GRANT ALL ON DATABASE greentrack TO greentrack_user;
