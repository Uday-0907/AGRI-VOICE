import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as dotenvLib from 'dotenv';
import path from 'path';
import * as schema from './schema.js';

// Load environment configuration
const dotenv = dotenvLib.default || dotenvLib;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to local directory .env

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Validates and retrieves database configuration from environment variables.
 * Never logs or exposes password/secret values.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '5000', 10),
    };
  }

  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const database = process.env.POSTGRES_DB || 'agrivoice';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD;

  if (!password && process.env.NODE_ENV === 'production') {
    throw new Error('POSTGRES_PASSWORD is required in production environment.');
  }

  return {
    host,
    port,
    database,
    user,
    password: password || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '5000', 10),
  };
}

// Log sanitized connection parameters
const config = getDatabaseConfig();
const sanitizedTarget = config.connectionString 
  ? config.connectionString.replace(/:([^@]+)@/, ':***@')
  : `${config.user}@${config.host}:${config.port}/${config.database}`;

if (process.env.NODE_ENV !== 'test') {
  console.log(`[Database] Initializing connection pool for target: ${sanitizedTarget}`);
}

export const pool = new pg.Pool(config);

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client:', err.message);
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
