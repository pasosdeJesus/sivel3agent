import fs from 'fs'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { crawlWordPressSource } from '../lib/crawler/wordpress'
import type { WordPressSource } from '../lib/crawler/wordpress'

const START_MONTH = process.env.CRAWL_START || '2026/01'

async function crawl() {
  const db = newKyselyPostgresql()
  const sources: WordPressSource[] = JSON.parse(
    fs.readFileSync('config/sources-2026.json', 'utf-8'),
  )

  // Sort by priority
  sources.sort((a, b) => (a.priority || 99) - (b.priority || 99))

  let totalStored = 0

  for (const source of sources) {
    console.log(`\n=== ${source.name} (${source.baseUrl}) ===`)

    try {
      const { articles } = await crawlWordPressSource(source, {
        lastMonth: START_MONTH,
        lastPage: 1,
        totalProcessed: 0,
      })

      console.log(`  Found ${articles.length} articles`)

      let stored = 0
      for (const art of articles) {
        // Dedup by URL
        const exists = await db
          .selectFrom('source')
          .select('id')
          .where('url', '=', art.url)
          .executeTakeFirst()

        if (exists) continue

        try {
          await db
            .insertInto('source')
            .values({
              url: art.url,
              medium: source.name,
              title: art.title.slice(0, 500),
              published_at: art.date,
              content_hash: art.contentHash,
              clean_text: art.fullText,
              metadata: JSON.stringify({ region: art.region, crawled_from: 'crawl-2026' }),
            })
            .execute()

          stored++
        } catch (err) {
          // Skip duplicates silently
        }
      }

      console.log(`  Stored: ${stored} new articles`)
      totalStored += stored
    } catch (err) {
      console.error(`  ❌ ${source.name}: ${err instanceof Error ? err.message : err}`)
    }

    // Rate limit between sources
    await new Promise((r) => setTimeout(r, 2000))
  }

  console.log(`\n✅ Total stored: ${totalStored}`)
}

crawl()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
