import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';

const router = express.Router();

// Memory storage for file attachment
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

router.post('/request', upload.single('file'), async (req, res) => {
    try {
        const { email, phone, notes, specifications } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse the JSON string we sent from frontend
        let specs = {};
        try {
            specs = JSON.parse(specifications);
        } catch (e) {
            specs = { error: "Could not parse specs" };
        }

        const mailOptions = {
            from: `"ProtoDesign System" <${process.env.EMAIL_USER}>`,
            to: 'harshsingh63056@gmail.com', // ✅ Sent explicitly to Admin
            replyTo: email, // Reply directly to customer
            subject: `NEW QUOTE: ${file.originalname} - ₹${specs.estimatedPrice}`,
            html: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #007bff;">New 3D Printing Request</h2>
                    
                    <div style="background: #f9f9f9; padding: 15px; margin-bottom: 20px;">
                        <h3>👤 Customer Details</h3>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone}</p>
                    </div>

                    <div style="background: #e9f5ff; padding: 15px; margin-bottom: 20px;">
                        <h3>⚙️ Print Configuration</h3>
                        <ul>
                            <li><strong>Material:</strong> ${specs.material}</li>
                            <li><strong>Quality:</strong> ${specs.quality}</li>
                            <li><strong>Infill:</strong> ${specs.infill}</li>
                        </ul>
                    </div>

                    <div style="background: #fff8e1; padding: 15px; margin-bottom: 20px;">
                        <h3>📊 Model Stats & Estimate</h3>
                        <ul>
                            <li><strong>Volume:</strong> ${specs.stats?.volume} cm³</li>
                            <li><strong>Dimensions:</strong> ${specs.stats?.dimensions?.x} x ${specs.stats?.dimensions?.y} x ${specs.stats?.dimensions?.z} cm</li>
                            <li><strong>Est. Time:</strong> ${specs.estimatedTime}</li>
                            <li><strong>Est. Price:</strong> ₹${specs.estimatedPrice}</li>
                        </ul>
                    </div>

                    <p><strong>Customer Notes:</strong><br/>${notes || "None"}</p>
                    
                    <hr/>
                    <p style="font-size: 12px; color: #666;">
                        The 3D model file is attached to this email. Open it in your slicer to verify the price.
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: file.originalname,
                    content: file.buffer
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true });

    } catch (error) {
        console.error('Quote Email Error:', error);
        res.status(500).json({ error: 'Failed to send quote' });
    }
});

export default router;