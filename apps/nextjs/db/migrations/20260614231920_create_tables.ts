import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('source')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('url', 'varchar(500)', (col) => col.unique().notNull())
    .addColumn('medium', 'varchar(100)')
    .addColumn('title', 'varchar(500)')
    .addColumn('published_at', 'timestamp')
    .addColumn('fetched_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('content_hash', 'varchar(66)', (col) => col.unique())
    .addColumn('raw_content', 'text')
    .addColumn('clean_text', 'text')
    .addColumn('metadata', 'jsonb')
    .execute();

  await db.schema
    .createTable('pre_alert')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('event_hash', 'varchar(66)', (col) => col.unique().notNull())
    .addColumn('json_data', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) => col.defaultTo('pending'))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()'))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo('now()'))
    .execute();

  await db.schema
    .createTable('pre_alert_source')
    .addColumn('pre_alert_id', 'integer', (col) => col.notNull())
    .addColumn('source_id', 'integer', (col) => col.notNull())
    .addForeignKeyConstraint('fk_pre_alert_source_pre_alert', ['pre_alert_id'], 'pre_alert', ['id'], (cb) => cb.onDelete('cascade'))
    .addForeignKeyConstraint('fk_pre_alert_source_source', ['source_id'], 'source', ['id'], (cb) => cb.onDelete('cascade'))
    .addPrimaryKeyConstraint('pk_pre_alert_source', ['pre_alert_id', 'source_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('pre_alert_source').execute();
  await db.schema.dropTable('pre_alert').execute();
  await db.schema.dropTable('source').execute();
}
