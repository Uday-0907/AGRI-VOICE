// Setup file to load environment variables before tests run
import * as dotenvLib from 'dotenv';
import path from 'path';

const dotenv = dotenvLib.default || dotenvLib;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to local .env