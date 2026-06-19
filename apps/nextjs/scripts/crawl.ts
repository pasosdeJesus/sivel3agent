import { CheerioCrawler } from 'crawlee'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { classifyByKeywords } from '../lib/classifyByKeywords'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Historical crawler for sources without usable RSS feeds (WordPress monthly
 * archives, SPIP, static HTML). Idempotent: skips URLs already in `source`.
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/crawl.ts [--year YYYY] [--legacy] [--source NAME]
 *
 * Flags:
 *   --year 2026    Crawl monthly archives for a specific year
 *                  (e.g., /2026/01/, /2026/02/, ...)
 *   --legacy       Crawl full historical range: from first known article year
 *                  to current year. Use for at‑risk sources (risk: "high")
 *   --source NAME  Filter by medium name or URL fragment
 *   --list         List configured legacy sources and exit
 *
 * Environment variables:
 *   CRAWL_CUTOFF        Override minimum date (default: 2026-01-01 for --year,
 *                       2015-01-01 for --legacy). Format: YYYY-MM-DD
 *   CRAWL_MAX_REQUESTS  Override maxRequestsPerCrawl (default: 1000)
 *   CRAWL_CONCURRENCY   Override maxConcurrency (default: 2)
 *
 * Examples:
 *   # Crawl all legacy sources for 2026
 *   node_modules/.bin/tsx scripts/crawl.ts --year 2026
 *
 *   # Archive Contagio Radio before it goes offline
 *   node_modules/.bin/tsx scripts/crawl.ts --legacy --source "Contagio Radio"
 *
 *   # List available sources
 *   node_modules/.bin/tsx scripts/crawl.ts --list
 *
 * Sources are defined in config/sources.json.
 */

interface SourceDef {
  name: string
  type: string
  baseUrl: string
  region: string
  risk: 'high' | 'low'
  selectors: {
    list: string
    title: string
    date: string
    body: string
  }
}

interface SourcesConfig {
  active: Array<{ name: string; url: string; region: string }>
  legacy: SourceDef[]
}

function loadSources(): SourceDef[] {
  const configPath = resolve(__dirname, '..', 'config', 'sources.json')
  const raw = readFileSync(configPath, 'utf-8')
  const config: SourcesConfig = JSON.parse(raw)
  return config.legacy
}

function parseArgs(): {
  year: number | null
  legacy: boolean
  sourceFilter: string | null
  list: boolean
} {
  const args = process.argv.slice(2)
  let year: number | null = null
  let legacy = false
  let sourceFilter: string | null = null
  let list = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      year = parseInt(args[i + 1])
      i++
    } else if (args[i] === '--legacy') {
      legacy = true
    } else if (args[i] === '--source' && args[i + 1]) {
      sourceFilter = args[i + 1]
      i++
    } else if (args[i] === '--list') {
      list = true
    }
  }

  return { year, legacy, sourceFilter, list }
}

function buildArchiveUrls(
  sources: SourceDef[],
  startYear: number,
  endYear: number,
): string[] {
  const urls: string[] = []
  for (const src of sources) {
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        urls.push(`${src.baseUrl}/${y}/${String(m).padStart(2, '0')}/`)
      }
    }
  }
  return urls
}

async function main() {
  const { year, legacy, sourceFilter, list } = parseArgs()
  const allSources = loadSources()

  if (list) {
    console.log('Legacy sources (no usable RSS):\n')
    for (const s of allSources) {
      const risk = s.risk === 'high' ? '⚠️  HIGH' : '   low'
      console.log(`  ${risk}  ${s.name.padEnd(30)} ${s.baseUrl}`)
    }
    process.exit(0)
  }

  if (!year && !legacy) {
    console.error('Usage: crawl.ts [--year YYYY] [--legacy] [--source NAME] [--list]')
    console.error('  --year 2026   Crawl specific year monthly archives')
    console.error('  --legacy      Full historical range (for at‑risk sources)')
    console.error('  --source NAME Filter by medium name')
    console.error('  --list        List configured sources')
    process.exit(1)
  }

  // Filter sources
  let sources = allSources
  if (sourceFilter) {
    const filter = sourceFilter.toLowerCase()
    sources = allSources.filter(
      (s) =>
        s.name.toLowerCase() === filter || s.baseUrl.includes(filter),
    )
    if (sources.length === 0) {
      console.error(`❌ No source matches "${sourceFilter}". Use --list to see available.`)
      process.exit(1)
    }
  }

  // Date range
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let startYear: number
  let endYear: number
  const cutoffDate = process.env.CRAWL_CUTOFF
    ? new Date(process.env.CRAWL_CUTOFF)
    : legacy
      ? new Date('2015-01-01')
      : new Date(`${year || currentYear}-01-01`)

  if (legacy) {
    startYear = cutoffDate.getFullYear()
    endYear = currentYear
  } else {
    startYear = year!
    endYear = year!
  }

  const startUrls = buildArchiveUrls(sources, startYear, endYear)
  // Filter out future months for current year
  const validUrls = startUrls.filter((url) => {
    // Only filter current year months that haven't happened yet
    if (!legacy && year === currentYear) return true
    if (legacy) {
      const match = url.match(/\/(\d{4})\/(\d{2})\/$/)
      if (match) {
        const y = parseInt(match[1])
        const m = parseInt(match[2])
        if (y === currentYear && m > currentMonth) return false
      }
    }
    return true
  })

  // Warn about high-risk sources
  const highRisk = sources.filter((s) => s.risk === 'high')
  if (highRisk.length > 0) {
    console.log(`⚠️  High‑risk sources (archive before they go offline):`)
    for (const s of highRisk) console.log(`   ${s.name} — ${s.baseUrl}`)
    console.log('')
  }

  console.log(`Mode: ${legacy ? `legacy (${startYear}-${endYear})` : `year ${year}`}`)
  if (sourceFilter) console.log(`Filter: ${sourceFilter}`)
  console.log(`Sources: ${sources.map((s) => s.name).join(', ')}`)
  console.log(`Archive URLs: ${validUrls.length} (${startYear}-01 to ${endYear}-${String(currentMonth).padStart(2, '0')})\n`)

  const db = newKyselyPostgresql()
  let totalStored = 0

  const maxRequests = parseInt(process.env.CRAWL_MAX_REQUESTS || '1000')
  const maxConcurrency = parseInt(process.env.CRAWL_CONCURRENCY || '2')

  const crawler = new CheerioCrawler({
    maxConcurrency,
    maxRequestsPerCrawl: maxRequests,
  })

  // Default handler: archive pages → extract article links → enqueue
  crawler.router.addDefaultHandler(async ({ $, request, log, enqueueLinks }) => {
    const src = sources.find((s) => request.url.startsWith(s.baseUrl))
    if (!src) return

    const links = $(src.selectors.list)
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter(Boolean)
      .map((href) => {
        const h = href as string
        return h.startsWith('http') ? h : `${src.baseUrl}${h.startsWith('/') ? '' : '/'}${h}`
      })
      .filter((url) => {
        // Basic article filtering
        try {
          return (
            url.includes(src.baseUrl.replace('https://', '').replace('www.', '')) &&
            !url.includes('/category/') &&
            !url.includes('/author/') &&
            !url.includes('/page/') &&
            !url.includes('share=') &&
            // WP archive pages have /YYYY/MM/ pattern — skip those
            !/\/\d{4}\/\d{2}\/$/.test(url)
          )
        } catch {
          return false
        }
      })

    const uniqueLinks = [...new Set(links)]
    log.info(`${request.url}: ${uniqueLinks.length} article links`)

    for (const articleUrl of uniqueLinks.slice(0, 15)) {
      const exists = await db
        .selectFrom('source')
        .select('id')
        .where('url', '=', articleUrl)
        .executeTakeFirst()
      if (exists) continue

      await enqueueLinks({
        urls: [articleUrl],
        label: 'article',
      })
    }
  })

  // Article detail handler
  crawler.router.addHandler('article', async ({ $, request, log }) => {
    try {
      const src = sources.find((s) => request.url.startsWith(s.baseUrl))
      const mediumName = src?.name || 'Unknown'

      const title =
        $(src?.selectors.title || 'h1').first().text().trim() ||
        $('h1').first().text().trim() ||
        ''
      const dateStr =
        $(src?.selectors.date || 'time').first().attr('datetime') ||
        $('time').first().attr('datetime') ||
        $(src?.selectors.date || 'time').first().text().trim() ||
        ''

      let bodyText = ''
      const bodySel = src?.selectors.body || 'div.entry-content'
      for (const sel of bodySel.split(', ')) {
        const text = $(sel).text().trim()
        if (text.length > 300) {
          bodyText = text
          break
        }
      }
      if (!bodyText) bodyText = $('body').text().trim()

      if (!title || bodyText.length < 150) return

      const cleanText = bodyText.replace(/\s+/g, ' ').trim()
      const date = dateStr ? new Date(dateStr) : null
      if (date && date < cutoffDate) return

      const contentHash = createHash('sha256').update(cleanText).digest('hex')

      const kw = classifyByKeywords(cleanText, title)
      const isRelevant = kw.confidence === 'high' ? kw.relevant : null
      const reason = kw.confidence === 'high' ? `[kw] ${kw.reason}` : null

      await db
        .insertInto('source')
        .values({
          url: request.url,
          medium: mediumName,
          title: title.slice(0, 500),
          published_at: date,
          content_hash: contentHash,
          clean_text: cleanText,
          metadata: JSON.stringify({ region: src?.region || 'Colombia' }),
          is_relevant: isRelevant,
          classification_reason: reason,
        })
        .execute()

      totalStored++
      log.info(`  ✅ [${totalStored}] ${title.slice(0, 70)} (${cleanText.length} chars)`)
    } catch (err) {
      // skip
    }
  })

  await crawler.run(validUrls)

  const count = await db
    .selectFrom('source')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .executeTakeFirst()
  console.log(`\n✅ Stored this run: ${totalStored}`)
  console.log(`✅ Total sources in DB: ${count?.c || 0}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
