import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('source')
    .addColumn('detected_at', 'timestamp', (col) => col.defaultTo(null))
    .execute()

  await db.schema
    .createIndex('idx_source_detected_at')
    .on('source')
    .column('detected_at')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_source_detected_at').ifExists().execute()
  await db.schema.alterTable('source').dropColumn('detected_at').execute()
}
