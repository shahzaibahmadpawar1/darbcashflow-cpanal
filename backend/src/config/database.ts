import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../db/schema';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Parse MySQL connection string: mysql://user:password@host:port/database
function parseConnectionString(url: string) {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 3306,
            user: parsed.username,
            password: parsed.password,
            database: parsed.pathname.slice(1), // Remove leading '/'
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
    } catch (error) {
        // If URL parsing fails, assume it's already a connection object or use defaults
        console.warn('Failed to parse DATABASE_URL, using defaults');
        return {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: '',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
    }
}

// Create MySQL connection pool
const connectionConfig = parseConnectionString(connectionString);
const connection = mysql.createPool(connectionConfig);

const db = drizzle(connection, { schema, mode: 'default' });

// Helper function to get last insert ID (MySQL alternative to $returningId)
// Note: LAST_INSERT_ID() is connection-specific, so this works within the same connection
export const getLastInsertId = async (tx?: any): Promise<number> => {
    const dbInstance = tx || db;
    const result = await dbInstance.execute(sql`SELECT LAST_INSERT_ID() as id`);
    // Drizzle execute returns [rows, fields] format similar to mysql2
    const rows = result[0] as Array<{ id: number | bigint }>;
    if (!rows || rows.length === 0 || !rows[0]) {
        throw new Error('Failed to get last insert ID');
    }
    return Number(rows[0].id);
};

export default db;