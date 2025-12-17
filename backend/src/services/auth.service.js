import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // Built-in Node module
import { emailService } from './email.service.js'; // Import the new service


// Authentication service
export const authService = {
    /**
     * User signup - Create new user account
     */
    async signup(email, password, fullName) {
        // Validation
        if (!email || !password || !fullName) {
            throw new Error('Email, password, and full name are required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Check if user already exists
        const existing = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing) throw new Error('Email already registered');

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await db.one(
            `INSERT INTO users (email, password_hash, full_name)
             VALUES ($1, $2, $3)
                 RETURNING id, email, full_name, created_at`,
            [email.toLowerCase(), hashedPassword, fullName]
        );

        await db.none('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user.id, 'user']);

        // ✅ NEW: Send Welcome Email asynchronously (don't await strictly if you want speed)
        emailService.sendWelcomeEmail(user.email, user.full_name)
            .catch(err => console.error("Failed to send welcome email:", err));


        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const signOptions = {
            expiresIn: (process.env.JWT_EXPIRY || '7d'),
        };

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: 'user',
            },
            jwtSecret,
            signOptions
        );


        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name, // Note: Use snake_case from DB result
                createdAt: user.created_at // Note: Use snake_case from DB result
            },
            token,
            role: 'user'
        };
    },


    // ✅ NEW: Forgot Password
    async forgotPassword(email) {
        const user = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (!user) throw new Error('User not found');

        // Generate random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save token to DB
        await db.none(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [resetToken, tokenExpiry, user.id]
        );

        // Send Email
        await emailService.sendPasswordResetEmail(email, resetToken);

        return { message: 'Password reset email sent' };
    },

    // ✅ NEW: Reset Password
    async resetPassword(token, newPassword) {
        if (!token || !newPassword) throw new Error('Missing token or password');

        // Find user with valid token
        const user = await db.oneOrNone(
            `SELECT id FROM users
             WHERE reset_password_token = $1
               AND reset_password_expires > NOW()`,
            [token]
        );

        if (!user) throw new Error('Invalid or expired token');

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear token
        await db.none(
            `UPDATE users
             SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL
             WHERE id = $2`,
            [hashedPassword, user.id]
        );

        return { message: 'Password successfully reset' };
    },

    /**
     * User login - Authenticate existing user
     */
    async login(email, password) {
        // Validation
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Find user by email
        const user = await db.oneOrNone(
            'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        // Check if user exists
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        // Note: property is password_hash in DB, accessed as passwordHash by pg-promise
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            throw new Error('Invalid credentials');
        }

        // Get user role
        const userRole = await db.oneOrNone(
            `SELECT role FROM user_roles 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );

        const role = userRole?.role || 'user';

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const signOptions = {
            expiresIn: (process.env.JWT_EXPIRY || '7d'),
        };

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role
            },
            jwtSecret,
            signOptions
        );
        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name, // Note: Use snake_case from DB result
                createdAt: user.created_at // Note: Use snake_case from DB result
            },
            token,
            role
        };
    },

    /**
     * Verify JWT token validity
     */
    async verifyToken(token) {
        try {
            if (!process.env.JWT_SECRET) {
                throw new Error('JWT_SECRET is not defined');
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return {
                valid: true,
                decoded
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    },

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const user = await db.oneOrNone(
            'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            fullName: user.full_name, // Note: Use snake_case from DB result
            createdAt: user.created_at // Note: Use snake_case from DB result
        };
    },

    /**
     * Change user password
     */
    async changePassword(userId, oldPassword, newPassword) {
        // Validation
        if (!oldPassword || !newPassword) {
            throw new Error('Both old and new passwords are required');
        }

        if (newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters');
        }

        // Get current password hash
        const user = await db.oneOrNone(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        // Verify old password
        // Note: property is password_hash in DB, accessed as passwordHash by pg-promise
        const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);

        if (!passwordMatch) {
            throw new Error('Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.none(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
    }
};