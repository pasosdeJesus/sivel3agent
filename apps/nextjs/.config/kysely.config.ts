import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH || resolve(process.cwd(), '../.env') })
import { Kysely, PostgresDialect } from 'kysely'
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl'
import { Pool } from 'pg'

import type { DB } from '@/db/db.d.ts'

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: 5432,
    }),
  }),
  migrations: {
    migrationFolder: '../db/migrations',
    getMigrationPrefix: getKnexTimestampPrefix,
  },
})

export function newKyselyPostgresql() {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port: 5432,
      }),
    }),
  })
}
