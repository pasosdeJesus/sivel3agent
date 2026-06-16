import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('source')
    .addColumn('is_relevant', 'boolean', (col) => col.defaultTo(null))
    .execute()

  await db.schema
    .alterTable('source')
    .addColumn('classification_reason', 'text')
    .execute()

  await db.schema
    .createIndex('idx_source_is_relevant')
    .on('source')
    .column('is_relevant')
    .execute()

  await db.schema
    .createIndex('idx_source_medium')
    .on('source')
    .column('medium')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_source_medium').ifExists().execute()
  await db.schema.dropIndex('idx_source_is_relevant').ifExists().execute()
  await db.schema.alterTable('source').dropColumn('classification_reason').execute()
  await db.schema.alterTable('source').dropColumn('is_relevant').execute()
}
