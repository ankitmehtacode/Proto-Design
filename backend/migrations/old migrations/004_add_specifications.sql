-- backend/migrations/004_add_specifications.sql

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;