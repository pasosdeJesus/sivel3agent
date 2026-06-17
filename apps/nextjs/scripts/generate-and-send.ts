import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { extractPreAlert } from '../lib/extractPreAlert'

const SIVEL3_API_URL = process.env.SIVEL3_API_URL
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10')
const DRY_RUN = process.env.DRY_RUN === 'true'

async function sendToSivel3(preAlert: {
  json: object
  eventHash: string
  sourceUrl: string
  preAlertId: number
}): Promise<number | null> {
  if (!SIVEL3_API_URL) {
    console.log(`  📡 sivel.xyz not configured — skipping send (local ID: ${preAlert.preAlertId})`)
    return null
  }

  console.log(`  📡 Sending to sivel.xyz…`)
  // TODO: implement when #44 is ready
  // const response = await fetch(SIVEL3_API_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     json_data: preAlert.json,
  //     event_hash: preAlert.eventHash,
  //     publisher_wallet: process.env.AGENT_WALLET_ADDRESS || '',
  //     source_urls: [preAlert.sourceUrl],
  //   }),
  // })
  console.log(`  ⏳ sivel.xyz send pending (#44 not implemented)`)
  return null
}

async function generateAndSend() {
  const db = newKyselyPostgresql()
  const startTime = new Date().toISOString()

  console.log(`[generate-and-send] Starting at ${startTime}`)
  console.log(`  Batch size: ${BATCH_SIZE}`)
  console.log(`  Dry run: ${DRY_RUN}`)
  console.log(`  sivel.xyz API: ${SIVEL3_API_URL || 'not configured'}`)

  const sources = await db
    .selectFrom('source')
    .select(['id', 'url', 'title', 'published_at', 'clean_text', 'medium'])
    .leftJoin('pre_alert_source', 'source.id', 'pre_alert_source.source_id')
    .where('pre_alert_source.pre_alert_id', 'is', null)
    .where('clean_text', 'is not', null)
    .where('is_relevant', '=', true)
    .limit(BATCH_SIZE)
    .execute()

  console.log(`\nFound ${sources.length} relevant unprocessed sources.\n`)

  let generated = 0
  let sent = 0
  let skipped = 0

  for (const source of sources) {
    if (!source.clean_text) continue

    console.log(`📄 ${source.title?.slice(0, 80)}`)
    console.log(`   Source: ${source.medium} | ${source.published_at?.toISOString().split('T')[0]}`)

    try {
      const { json, eventHash } = await extractPreAlert({
        title: source.title || '',
        date: source.published_at?.toISOString().split('T')[0] || '',
        text: source.clean_text,
        sourceUrl: source.url,
        sourceMedium: source.medium || 'Unknown',
      })

      // Dedup
      const dupCheck = await db
        .selectFrom('pre_alert')
        .select('id')
        .where('event_hash', '=', eventHash)
        .executeTakeFirst()

      if (dupCheck) {
        console.log(`   ⏭️  Duplicate (event_hash), skipping.`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`   🔍 Dry run — would save pre_alert.`)
        generated++
        continue
      }

      // Save locally
      const preAlert = await db
        .insertInto('pre_alert')
        .values({ event_hash: eventHash, json_data: json, status: 'pending' })
        .returning('id')
        .executeTakeFirst()

      if (!preAlert) {
        console.log(`   ❌ Failed to insert.`)
        skipped++
        continue
      }

      // Link source
      await db
        .insertInto('pre_alert_source')
        .values({ pre_alert_id: preAlert.id, source_id: source.id })
        .execute()

      console.log(`   ✅ Pre‑alert ID: ${preAlert.id} (${eventHash.slice(0, 16)}…)`)
      generated++

      // Send to sivel.xyz
      const remoteId = await sendToSivel3({
        json,
        eventHash,
        sourceUrl: source.url,
        preAlertId: preAlert.id,
      })
      if (remoteId) sent++

    } catch (err) {
      console.error(`   ❌ Error: ${err instanceof Error ? err.message : err}`)
      skipped++
    }
  }

  const endTime = new Date().toISOString()
  console.log(`\n[generate-and-send] Finished at ${endTime}`)
  console.log(`   Generated: ${generated} | Sent: ${sent} | Skipped: ${skipped}`)
}

const isMain = process.argv[1]?.includes('generate-and-send')
if (isMain) {
  generateAndSend()
    .then(() => process.exit(0))
    .catch((e) => { console.error('Fatal:', e); process.exit(1) })
}

export { generateAndSend }
