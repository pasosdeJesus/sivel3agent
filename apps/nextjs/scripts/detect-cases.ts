import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { extractPreAlert } from '../lib/extractPreAlert'
import { detectCase } from '../lib/case-detector/index'

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5')

async function detectCases() {
  const db = newKyselyPostgresql()

  const pending = await db
    .selectFrom('source')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('clean_text', 'is not', null)
    .where('detected_at', 'is', null)
    .executeTakeFirst()

  console.log(`Pending articles: ${pending?.c || 0}\n`)

  const sources = await db
    .selectFrom('source')
    .select(['id', 'url', 'title', 'published_at', 'clean_text', 'medium'])
    .where('clean_text', 'is not', null)
    .where('detected_at', 'is', null)
    .orderBy('id')
    .limit(BATCH_SIZE)
    .execute()

  console.log(`Processing ${sources.length} articles (batch size: ${BATCH_SIZE})\n`)

  let cases = 0
  let nonCases = 0

  for (const source of sources) {
    if (!source.clean_text) continue

    console.log(`🔍 ${source.title?.slice(0, 80)}`)

    const result = await detectCase(
      {
        title: source.title || '',
        cleanText: source.clean_text,
      },
      (article) =>
        extractPreAlert({
          title: article.title,
          date: source.published_at?.toISOString().split('T')[0] || '',
          text: article.text,
          sourceUrl: source.url,
          sourceMedium: source.medium || 'Unknown',
        }),
    )

    await db
      .updateTable('source')
      .set({ detected_at: new Date() })
      .where('id', '=', source.id)
      .execute()

    if (result.isCase && result.json) {
      // Save to pre_alert
      const { keccak256, toBytes } = await import('viem')
      const eventHash = keccak256(toBytes(JSON.stringify(result.json)))

      const dup = await db
        .selectFrom('pre_alert')
        .select('id')
        .where('event_hash', '=', eventHash)
        .executeTakeFirst()

      if (dup) {
        console.log(`   ⏭️  Duplicate pre_alert`)
        nonCases++
      } else {
        const pa = await db
          .insertInto('pre_alert')
          .values({
            event_hash: eventHash,
            json_data: result.json,
            status: 'pending',
          })
          .returning('id')
          .executeTakeFirst()

        await db
          .insertInto('pre_alert_source')
          .values({ pre_alert_id: pa!.id, source_id: source.id })
          .execute()

        console.log(`   ✅ CASE: ${result.category} | ${result.victimCount} victims | ID: ${pa!.id}`)
        cases++
      }
    } else {
      console.log(`   ❌ NOT A CASE: ${result.reason}`)
      nonCases++
    }
  }

  console.log(`\n✅ Done. Cases: ${cases}, Non-cases: ${nonCases}`)

  // Show total pre_alerts
  const total = await db
    .selectFrom('pre_alert')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirst()

  console.log(`Total pre_alerts in DB: ${total?.count || 0}`)
}

detectCases()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
