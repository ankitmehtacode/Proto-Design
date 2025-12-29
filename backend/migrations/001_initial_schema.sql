-- 001_initial_schema.sql
-- Combined migration for Proto Design (001-008)

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create Enums
DROP TYPE IF EXISTS app_role;
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- 3. Trigger Function for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Users Table
CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       email VARCHAR(255) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       full_name VARCHAR(255),
                       phone_number VARCHAR(20),          -- Added from 007
                       avatar_url TEXT,                   -- Added from 007
                       reset_password_token TEXT,         -- Added from 005
                       reset_password_expires TIMESTAMP,  -- Added from 005
                       created_at TIMESTAMP DEFAULT now(),
                       updated_at TIMESTAMP DEFAULT now()
);

-- 5. User Roles
CREATE TABLE user_roles (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            role app_role NOT NULL DEFAULT 'user',
                            created_at TIMESTAMP DEFAULT now(),
                            UNIQUE(user_id, role)
);

-- 6. Products Table
CREATE TABLE products (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          name TEXT NOT NULL,
                          description TEXT,
                          price DECIMAL(10,2) NOT NULL,
                          image_url TEXT,
                          image_data BYTEA,
                          category TEXT DEFAULT '3d_printer',
                          sub_category TEXT DEFAULT NULL,       -- Added from 003
                          short_description TEXT DEFAULT NULL,  -- Added from 003
                          stock INTEGER DEFAULT 0,
                          likes_count INTEGER DEFAULT 0,
                          average_rating DECIMAL(3,2) DEFAULT 0, -- Added from 003
                          review_count INTEGER DEFAULT 0,        -- Added from 003
                          specifications JSONB DEFAULT '{}'::jsonb, -- Added from 004
                          video_url TEXT,                        -- Added from 006
                          is_archived BOOLEAN DEFAULT FALSE,     -- Added from 008
                          created_at TIMESTAMP DEFAULT now(),
                          updated_at TIMESTAMP DEFAULT now()
);

-- 7. Product Images
CREATE TABLE product_images (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                image_url TEXT,
                                image_data BYTEA,
                                display_order INTEGER NOT NULL DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Product Likes
CREATE TABLE product_likes (
                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                               created_at TIMESTAMP DEFAULT now(),
                               UNIQUE(user_id, product_id)
);

-- 9. Carts
CREATE TABLE carts (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                       created_at TIMESTAMP DEFAULT now(),
                       updated_at TIMESTAMP DEFAULT now(),
                       UNIQUE(user_id)
);

-- 10. Cart Items
CREATE TABLE cart_items (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
                            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                            quantity INTEGER NOT NULL DEFAULT 1,
                            created_at TIMESTAMP DEFAULT now(),
                            updated_at TIMESTAMP DEFAULT now(),
                            UNIQUE(cart_id, product_id)
);

-- 11. Orders
CREATE TABLE orders (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                        subtotal_amount DECIMAL(10,2) NOT NULL,
                        tax_amount DECIMAL(10,2) NOT NULL,
                        shipping_amount DECIMAL(10,2) NOT NULL,
                        total_amount DECIMAL(10,2) NOT NULL,
                        status VARCHAR(50) DEFAULT 'pending',
                        payment_gateway VARCHAR(50) DEFAULT 'razorpay',
                        shipping_address JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Order Items
CREATE TABLE order_items (
                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                             product_id UUID REFERENCES products(id),
                             quantity INTEGER NOT NULL DEFAULT 1,
                             price DECIMAL(10,2) NOT NULL,
                             line_total DECIMAL(10,2) NOT NULL
);

-- 13. Reference Images
CREATE TABLE reference_images (
                                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  file_name TEXT NOT NULL,
                                  file_url TEXT NOT NULL,
                                  created_at TIMESTAMP DEFAULT now()
);

-- 14. Reviews (Added from 003)
CREATE TABLE reviews (
                         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                         user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                         rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                         comment TEXT,
                         created_at TIMESTAMP DEFAULT now()
);

-- 15. Quotes (Added from 006)
CREATE TABLE quotes (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                        email VARCHAR(255) NOT NULL,
                        phone VARCHAR(50),
                        file_url TEXT NOT NULL,
                        file_name TEXT NOT NULL,
                        specifications JSONB NOT NULL,
                        status VARCHAR(50) DEFAULT 'pending',
                        estimated_price DECIMAL(10,2),
                        admin_notes TEXT,
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
);

-- 16. User Addresses (Added from 007)
CREATE TABLE user_addresses (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                label VARCHAR(50) DEFAULT 'Home',
                                full_name VARCHAR(255) NOT NULL,
                                phone VARCHAR(20) NOT NULL,
                                email VARCHAR(255),
                                address_line1 TEXT NOT NULL,
                                city VARCHAR(100) NOT NULL,
                                state VARCHAR(100) NOT NULL,
                                pincode VARCHAR(20) NOT NULL,
                                country VARCHAR(100) DEFAULT 'India',
                                is_default BOOLEAN DEFAULT false,
                                created_at TIMESTAMP DEFAULT now(),
                                updated_at TIMESTAMP DEFAULT now()
);

-- 17. Saved Models (Added from 007)
CREATE TABLE saved_models (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                              name VARCHAR(255) NOT NULL,
                              file_url TEXT NOT NULL,
                              preview_url TEXT,
                              file_size_mb DECIMAL(10,2),
                              created_at TIMESTAMP DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_likes ON products(likes_count);
CREATE INDEX idx_products_is_archived ON products(is_archived);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_order ON product_images(product_id, display_order);
CREATE INDEX idx_product_likes_user_product ON product_likes(user_id, product_id);
CREATE INDEX idx_reference_images_user_id ON reference_images(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_email ON quotes(email);
CREATE UNIQUE INDEX idx_user_default_address ON user_addresses (user_id) WHERE is_default = true;
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_saved_models_user_id ON saved_models(user_id);

-- Apply Update Triggers to all tables
CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_product_images_updated_at BEFORE UPDATE ON product_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_product_likes_updated_at BEFORE UPDATE ON product_likes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_user_addresses_updated_at BEFORE UPDATE ON user_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();