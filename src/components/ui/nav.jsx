import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import db from '../config/database.js';
import { storageService } from '../services/storage.service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ✅ GET MY QUOTES
router.get('/my', authMiddleware, async (req, res) => {
    try {
        // Fetch by email OR user_id (if you have user_id in quotes table, otherwise email)
        // Since original quotes table only had email, we use req.userEmail
        const quotes = await db.any('SELECT * FROM quotes WHERE email = $1 ORDER BY created_at DESC', [req.userEmail]);
        res.json(quotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST REQUEST
router.post('/request', upload.single('file'), async (req, res) => {
    try {
        const { email, phone, notes, specifications } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // 1. Upload File
        const fileUrl = await storageService.uploadFile(file, 'quotes/stls');

        // 2. Parse Specifications
        let specs = {};
        try {
            specs = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
        } catch (e) {
            console.error("Spec Parse Error", e);
            specs = {};
        }

        const estPrice = specs.estimatedPrice || 0;

        // 3. Insert into DB
        await db.none(`
            INSERT INTO quotes (email, phone, file_url, file_name, specifications, estimated_price, admin_notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        `, [email, phone, fileUrl, file.originalname, specs, estPrice, notes]);

        // ... (Emails - kept brief for stability) ...

        res.json({ success: true, message: "Quote requested successfully" });
    } catch (error) {
        console.error('Quote Error:', error);
        res.status(500).json({ error: 'Failed to process quote' });
    }
});

// ADMIN ROUTES
router.get('/admin/all', async (req, res) => {
    try {
        const quotes = await db.any('SELECT * FROM quotes ORDER BY created_at DESC');
        res.json(quotes);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.none('UPDATE quotes SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;