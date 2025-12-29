-- backend/migrations/005_add_reset_token.sql

ALTER TABLE users
    ADD COLUMN reset_password_token TEXT,
ADD COLUMN reset_password_expires TIMESTAMP;