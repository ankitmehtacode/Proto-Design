-- backend/migrations/007_add_user_profile.sql

-- 1. Add Profile Fields to Users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create Addresses Table
CREATE TABLE user_addresses (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                label VARCHAR(50) DEFAULT 'Home', -- e.g., "Home", "Work"
                                full_name VARCHAR(255) NOT NULL,
                                phone VARCHAR(20) NOT NULL,
                                email VARCHAR(255), -- ✅ Added Email Field
                                address_line1 TEXT NOT NULL,
                                city VARCHAR(100) NOT NULL,
                                state VARCHAR(100) NOT NULL,
                                pincode VARCHAR(20) NOT NULL,
                                country VARCHAR(100) DEFAULT 'India',
                                is_default BOOLEAN DEFAULT false,
                                created_at TIMESTAMP DEFAULT now(),
                                updated_at TIMESTAMP DEFAULT now()
);

-- Ensure only one default address per user
CREATE UNIQUE INDEX idx_user_default_address
    ON user_addresses (user_id)
    WHERE is_default = true;

-- 3. Create Saved Models Table (for "My Model Saving")
CREATE TABLE saved_models (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                              name VARCHAR(255) NOT NULL,
                              file_url TEXT NOT NULL,
                              preview_url TEXT, -- Image snapshot of the 3D model
                              file_size_mb DECIMAL(10,2),
                              created_at TIMESTAMP DEFAULT now()
);

-- Index for speed
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_saved_models_user_id ON saved_models(user_id);