-- 1. Add new columns to products table
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sub_category TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 2. Create Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
                                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT now()
    );

-- 3. Create Index for performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

-- 4. 🔥 GRANT PERMISSIONS (Fixes "Permission denied" error)
GRANT ALL PRIVILEGES ON TABLE reviews TO protodesign_user;
GRANT ALL PRIVILEGES ON TABLE products TO protodesign_user; -- Ensure access to new columns