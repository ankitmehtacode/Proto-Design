-- backend/migrations/008_add_is_archived.sql

-- 1. Add is_archived column to products table
ALTER TABLE products
    ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;

-- 2. Add index for faster filtering
CREATE INDEX idx_products_is_archived ON products(is_archived);

-- 3. (Optional) Update existing nulls if any (safety check)
UPDATE products SET is_archived = FALSE WHERE is_archived IS NULL;