import { execSync } from 'child_process';

/**
 * Check if psql command is available in the system PATH
 * @returns boolean true if psql is available, false otherwise
 */
export function psqlAvailable(): boolean {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if all prerequisites for database integration tests are met:
 * 1. PostgreSQL superuser credentials are configured in environment
 * 2. psql command-line tool is available in PATH
 * @returns boolean true if database tests can run, false otherwise
 */
export function canRunDbTests(): boolean {
  const superuserConfigured = process.env.PG_SUPERUSER && process.env.PG_SUPERUSER_PASSWORD !== undefined;
  return superuserConfigured && psqlAvailable();
}

/**
 * Skip condition for database integration tests
 * Use as: const dbTest = canRunDbTests() ? describe : describe.skip;
 */
export const dbTest = canRunDbTests() ? describe : describe.skip;