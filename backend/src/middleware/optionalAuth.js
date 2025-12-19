import jwt from 'jsonwebtoken';

const optionalAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (process.env.JWT_SECRET) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.userId = decoded.userId || decoded.id;
                req.userEmail = decoded.email;
            }
        }
        next();
    } catch (error) {
        // Token invalid or expired? No problem, treat as guest.
        next();
    }
};

export default optionalAuthMiddleware;