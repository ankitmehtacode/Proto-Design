import express from 'express';
import db from '../config/database.js';
import authMiddleware from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();

// Multer configuration for multiple images (up to 7)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB per image
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getLikesCount(productId) {
    const result = await db.oneOrNone(
        'SELECT COALESCE(likes_count, 0) as likes_count FROM products WHERE id = $1',
        [productId]
    );
    return parseInt(result?.likes_count) || 0;
}

// ============================================
// REVIEW ROUTES
// ============================================

// GET /api/products/:id/reviews
router.get('/:id/reviews', async (req, res, next) => {
    try {
        const { id } = req.params;
        const reviews = await db.any(`
            SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as user
            FROM reviews r
                JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1
            ORDER BY r.created_at DESC
        `, [id]);
        res.json({ success: true, data: reviews });
    } catch (error) {
        next(error);
    }
});

// POST /api/products/:id/reviews (Authenticated & Purchase Check)
router.post('/:id/reviews', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.userId;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Invalid rating (1-5)' });
        }

        // 🔥 CHECK PURCHASE: User must have a valid order for this product
        // We exclude cancelled or pending_payment orders to ensure real purchase
        const purchaseCheck = await db.oneOrNone(`
            SELECT id FROM orders 
            WHERE user_id = $1 
            AND product_id = $2 
            AND status NOT IN ('cancelled', 'pending_payment')
            LIMIT 1
        `, [userId, id]);

        if (!purchaseCheck) {
            return res.status(403).json({ error: 'User Needs to purchase product first' });
        }

        // 1. Insert Review
        await db.none(`
            INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [id, userId, rating, comment]);

        // 2. Recalculate Average Rating & Count
        const stats = await db.one(`
            SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg
            FROM reviews WHERE product_id = $1
        `, [id]);

        // 3. Update Product
        await db.none(`
            UPDATE products
            SET review_count = $1, average_rating = $2
            WHERE id = $3
        `, [stats.count, stats.avg, id]);

        res.json({ success: true, message: 'Review added successfully' });
    } catch (error) {
        console.error("Review Error:", error);
        next(error);
    }
});

// ============================================
// LIKE ROUTES
// ============================================

router.get('/:id/likes', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!req.userId) return res.json({ success: true, isLiked: false, likesCount: 0 });

        let isLiked = false;
        try {
            const like = await db.oneOrNone(
                'SELECT id FROM product_likes WHERE user_id = $1 AND product_id = $2',
                [req.userId, id]
            );
            isLiked = !!like;
        } catch (e) { /* ignore table errors during dev */ }

        let likesCount = await getLikesCount(id);
        res.json({ success: true, isLiked, likesCount });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });

        const existing = await db.oneOrNone(
            'SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2',
            [req.userId, id]
        );

        if (existing) return res.status(400).json({ error: 'Already liked' });

        await db.tx(async (t) => {
            await t.none(
                'INSERT INTO product_likes (user_id, product_id, created_at) VALUES ($1, $2, NOW())',
                [req.userId, id]
            );
            await t.none(
                'UPDATE products SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = $1',
                [id]
            );
        });

        res.json({ success: true, isLiked: true, likesCount: await getLikesCount(id) });
    } catch (error) {
        res.status(500).json({ error: 'Like failed', details: error.message });
    }
});

router.delete('/:id/like', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.result(
            'DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2',
            [req.userId, id]
        );

        if (result.rowCount > 0) {
            await db.none(
                'UPDATE products SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
                [id]
            );
        }

        res.json({ success: true, isLiked: false, likesCount: await getLikesCount(id) });
    } catch (error) {
        next(error);
    }
});

// ============================================
// PRODUCT CRUD ROUTES
// ============================================

// GET /api/products
router.get('/', async (req, res, next) => {
    try {
        const { category, sub_category, search, sort } = req.query;

        let query = `
      SELECT 
        p.*,
        COALESCE(
          pi1.image_url,
          CASE WHEN pi1.image_data IS NOT NULL 
            THEN 'data:image/jpeg;base64,' || encode(pi1.image_data, 'base64')
            ELSE NULL 
          END
        ) as image_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'image_data', CASE WHEN pi.image_data IS NOT NULL 
                THEN 'data:image/jpeg;base64,' || encode(pi.image_data, 'base64')
                ELSE NULL 
              END,
              'display_order', pi.display_order
            ) ORDER BY pi.display_order
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) as product_images
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM product_images 
        WHERE product_id = p.id 
        ORDER BY display_order ASC 
        LIMIT 1
      ) pi1 ON true
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE 1=1
    `;

        const params = [];
        let paramIdx = 1;

        if (category && category !== 'all') {
            query += ` AND p.category = $${paramIdx++}`;
            params.push(category);
        }

        if (sub_category && sub_category !== 'all') {
            query += ` AND p.sub_category = $${paramIdx++}`;
            params.push(sub_category);
        }

        if (search) {
            query += ` AND (p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.short_description ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        query += ` GROUP BY p.id, pi1.id, pi1.image_url, pi1.image_data ORDER BY p.created_at DESC`;

        const products = await db.manyOrNone(query, params);
        res.json({ success: true, count: products.length, data: products });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await db.oneOrNone(`
            SELECT p.*,
                   COALESCE(
                           json_agg(
                                   json_build_object(
                                           'id', pi.id,
                                           'image_url', pi.image_url,
                                           'image_data', CASE WHEN pi.image_data IS NOT NULL
                                                                  THEN 'data:image/jpeg;base64,' || encode(pi.image_data, 'base64')
                                                              ELSE NULL
                                               END,
                                           'display_order', pi.display_order
                                   ) ORDER BY pi.display_order
                           ) FILTER (WHERE pi.id IS NOT NULL),
                           '[]'::json
                   ) as product_images
            FROM products p
            LEFT JOIN product_images pi ON p.id = pi.product_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

// POST /api/products
router.post('/', authMiddleware, upload.array('images', 7), async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });

        const { name, description, short_description, price, category, sub_category, stock, specifications } = req.body;

        // Parse specifications from string (FormData) to JSON object
        const specs = specifications ? JSON.parse(specifications) : {};

        const product = await db.one(`
            INSERT INTO products (name, description, short_description, price, category, sub_category, stock, specifications, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                RETURNING id, name
        `, [name, description, short_description, parseFloat(price), category, sub_category, parseInt(stock) || 0, specs]);

        if (req.files?.length) {
            const inserts = req.files.map((f, i) => db.none(
                `INSERT INTO product_images (product_id, image_data, display_order) VALUES ($1, $2, $3)`,
                [product.id, f.buffer, i]
            ));
            await Promise.all(inserts);
        }

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, upload.array('images', 7), async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });

        const { id } = req.params;
        const { name, description, short_description, price, category, sub_category, stock, imagesToDelete, specifications   } = req.body;

        const updates = [];
        const params = [];
        let idx = 1;

        const addField = (key, val) => {
            if (val !== undefined) {
                updates.push(`${key} = $${idx++}`);
                params.push(val);
            }
        };

        addField('name', name);
        addField('description', description);
        addField('short_description', short_description);
        addField('price', parseFloat(price));
        addField('category', category);
        addField('sub_category', sub_category);
        addField('stock', parseInt(stock));
        updates.push(`updated_at = NOW()`);

        if (specifications) {
            updates.push(`specifications = $${idx++}`);
            params.push(JSON.parse(specifications));
        }

        if (updates.length > 0) {
            params.push(id);
            await db.none(`UPDATE products SET ${updates.join(', ')} WHERE id = $${idx}`, params);
        }

        if (imagesToDelete) {
            const ids = JSON.parse(imagesToDelete);
            if (ids.length) {
                await db.none('DELETE FROM product_images WHERE id = ANY($1::uuid[]) AND product_id = $2', [ids, id]);
            }
        }

        if (req.files?.length) {
            const inserts = req.files.map((f, i) => db.none(
                `INSERT INTO product_images (product_id, image_data, display_order, created_at, updated_at)
                 VALUES ($1, $2, (SELECT COALESCE(MAX(display_order), -1) + 1 FROM product_images WHERE product_id = $1), NOW(), NOW())`,
                [id, f.buffer]
            ));
            await Promise.all(inserts);
        }

        res.json({ success: true, message: 'Product updated' });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
        await db.none('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // 1. Get the order's timestamp to identify the whole group
        const order = await db.oneOrNone(
            'SELECT created_at, status FROM orders WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 2. Validation: Can only cancel if pending/processing
        const allowCancel = ['pending', 'pending_payment', 'processing'];
        if (!allowCancel.includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
        }

        // 3. Update ALL items in this order group to 'cancelled'
        await db.none(
            `UPDATE orders 
             SET status = 'cancelled' 
             WHERE user_id = $1 AND created_at = $2`,
            [userId, order.created_at]
        );

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        next(error);
    }
});

// PUT /api/orders/:id/address
router.put('/:id/address', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { address } = req.body;
        const userId = req.userId;

        if (!address) return res.status(400).json({ error: 'Address data required' });

        // 1. Get the order's timestamp
        const order = await db.oneOrNone(
            'SELECT created_at, status FROM orders WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // 2. Validation: Can only edit if pending/processing
        const allowEdit = ['pending', 'pending_payment', 'processing'];
        if (!allowEdit.includes(order.status)) {
            return res.status(400).json({ error: 'Cannot update address for shipped/delivered orders' });
        }

        // 3. Update address for ALL items in this order group
        await db.none(
            `UPDATE orders 
             SET shipping_address = $1 
             WHERE user_id = $2 AND created_at = $3`,
            [JSON.stringify(address), userId, order.created_at]
        );

        res.json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        console.error('Update address error:', error);
        next(error);
    }
});

export default router;