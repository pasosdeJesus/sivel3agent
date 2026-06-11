import dotenv from 'dotenv';
import path from 'path';

const testdir = process.env.TEST_DIR || 'tests/ordered';
const envPath = path.resolve(process.cwd(), '.env.test');
dotenv.config({ path: envPath });

console.log(`Usando entorno de ${envPath}`);
