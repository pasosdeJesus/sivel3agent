import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { classifyByKeywords } from '../lib/classifyByKeywords'
import { classifyNewsLLM } from '../lib/classifyNewsLLM'

async function classifyStoredSources(reset = false) {
  const db = newKyselyPostgresql()

  const sources = await db
    .selectFrom('source')
    .select(['id', 'title', 'clean_text', 'is_relevant'])
    .where((eb) =>
      reset
        ? eb('id', '>', 0)
        : eb('is_relevant', 'is', null),
    )
    .where('clean_text', 'is not', null)
    .limit(50)
    .execute()

  console.log(`Classifying ${sources.length} sources (reset=${reset})…\n`)

  for (const source of sources) {
    if (!source.clean_text) continue

    const kw = classifyByKeywords(source.clean_text, source.title || '')

    let isRelevant: boolean
    let reason: string

    if (kw.confidence === 'high') {
      isRelevant = kw.relevant
      reason = `[kw] ${kw.reason}`
    } else {
      try {
        const llm = await classifyNewsLLM(source.clean_text, source.title || '')
        isRelevant = llm.relevant
        reason = `[llm] ${llm.reason}`
      } catch {
        isRelevant = kw.relevant
        reason = `[kw-fallback] ${kw.reason}`
      }
    }

    await db
      .updateTable('source')
      .set({ is_relevant: isRelevant, classification_reason: reason })
      .where('id', '=', source.id)
      .execute()

    const icon = isRelevant ? '✅' : '❌'
    console.log(`${icon} ${source.title?.slice(0, 80)} → ${reason}`)
  }

  console.log('\n✅ Classification complete.')
}

const reset = process.argv.includes('--reset')
classifyStoredSources(reset)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
