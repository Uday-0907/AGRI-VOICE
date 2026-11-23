import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool, getDatabaseConfig } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const config = getDatabaseConfig();
  const sanitizedTarget = config.connectionString 
    ? config.connectionString.replace(/:([^@]+)@/, ':***@')
    : `${config.user}@${config.host}:${config.port}/${config.database}`;

  console.log(`[Migrate] Target database: ${sanitizedTarget}`);
  console.log('[Migrate] Verifying database connectivity...');

  try {
    const client = await pool.connect();
    console.log('[Migrate] Connection established.');

    // Check PostGIS extension status
    const extRes = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'");
    if (extRes.rows.length > 0) {
      console.log(`[Migrate] PostGIS extension detected: v${extRes.rows[0].extversion}`);
    } else {
      console.log('[Migrate] PostGIS extension not yet installed in database. Migration 0000 will create it.');
    }
    client.release();

    const migrationsFolder = path.resolve(__dirname, '../../../database/migrations');
    console.log(`[Migrate] Executing migrations from: ${migrationsFolder}`);

    await migrate(db, { migrationsFolder });

    console.log('[Migrate] [✓] Migrations successfully applied!');
  } catch (error: any) {
    console.error('[Migrate] [!] Migration execution failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.env.NODE_ENV !== 'test') {
  runMigrations();
}
