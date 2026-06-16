import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { extractPreAlert } from '../lib/extractPreAlert'

async function extractAndSave() {
  const db = newKyselyPostgresql()

  const sources = await db
    .selectFrom('source')
    .select(['id', 'url', 'title', 'published_at', 'clean_text', 'medium'])
    .leftJoin('pre_alert_source', 'source.id', 'pre_alert_source.source_id')
    .where('pre_alert_source.pre_alert_id', 'is', null)
    .where('clean_text', 'is not', null)
    .limit(10)
    .execute()

  for (const source of sources) {
    if (!source.clean_text) continue

    console.log(`Processing: ${source.title}`)

    const { json, eventHash } = await extractPreAlert({
      title: source.title || '',
      date: source.published_at?.toISOString().split('T')[0] || '',
      text: source.clean_text,
      sourceUrl: source.url,
      sourceMedium: source.medium || 'Unknown',
    })

    const dupCheck = await db
      .selectFrom('pre_alert')
      .select('id')
      .where('event_hash', '=', eventHash)
      .executeTakeFirst()

    if (dupCheck) {
      console.log(`  → Duplicate detected (event_hash), skipping.`)
      continue
    }

    const preAlert = await db
      .insertInto('pre_alert')
      .values({
        event_hash: eventHash,
        json_data: json,
        status: 'pending',
      })
      .returning('id')
      .executeTakeFirst()

    if (!preAlert) {
      console.log('  → Failed to insert pre_alert.')
      continue
    }

    await db
      .insertInto('pre_alert_source')
      .values({
        pre_alert_id: preAlert.id,
        source_id: source.id,
      })
      .execute()

    console.log(`  → Saved pre_alert ID: ${preAlert.id} (${eventHash.slice(0, 16)}…)`)
  }

  console.log('Extract and save completed.')
}

const isMain = process.argv[1]?.includes('extract-and-save')
if (isMain) {
  extractAndSave()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { extractAndSave }
