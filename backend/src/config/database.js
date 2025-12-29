import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize pg-promise
const pgp = pgPromise({
    receive(data) {
        // Convert snake_case to camelCase
        for (const prop in data) {
            const camel = prop.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            if (prop !== camel) {
                data[camel] = data[prop];
                delete data[prop];
            }
        }
    }
});

// Database connection configuration
const config = {
    host: 'localhost',
    port: 5432,
    database: 'protodesign',
    user: 'protodesign_user',
    password: '0000'
};

// Create database instance
const db = pgp(config);

// Test connection
db.connect()
    .then((obj) => {
        console.log('✅ Database connection successful');
        obj.done();
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error.message);
    });

export default db;