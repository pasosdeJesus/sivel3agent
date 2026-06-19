import { CheerioCrawler } from 'crawlee'
import { createHash } from 'crypto'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { classifyByKeywords } from '../lib/classifyByKeywords'

const CUTOFF = new Date('2026-01-01')

interface SourceDef {
  name: string
  baseUrl: string
  articleLinkSelector: string
  articleFilter?: (href: string) => boolean
}

const SOURCES: SourceDef[] = [
  {
    name: 'Comisión Intereclesial',
    baseUrl: 'https://www.justiciaypazcolombia.com',
    articleLinkSelector:
      'a[href*="/informe-"], a[href*="/rendicion-"], a[href*="/comunicado-"]',
    articleFilter: (h) =>
      !h.includes('/category/') && !h.includes('/author/') && !h.includes('share='),
  },
  {
    name: 'INDEPAZ',
    baseUrl: 'https://indepaz.org.co',
    articleLinkSelector: 'article h2 a, h2.entry-title a, h3 a[href]',
    articleFilter: (h) =>
      h.includes(indepazBase) && !h.includes('/category/') && !h.includes('/author/'),
  },
  {
    name: 'Contagio Radio',
    baseUrl: 'https://www.contagioradio.com',
    articleLinkSelector: 'h2 a, h3 a, .entry-title a',
    articleFilter: (h) =>
      h.includes(contagioBase) &&
      !h.includes('/category/') &&
      !h.includes('/author/') &&
      !h.includes('/page/'),
  },
  {
    name: 'Las2Orillas',
    baseUrl: 'https://www.las2orillas.co',
    articleLinkSelector: 'h2 a, h3 a, .post-title a',
    articleFilter: (h) =>
      h.includes(orillasBase) && !h.includes('/category/') && !h.includes('/author/'),
  },
  {
    name: 'Verdad Abierta',
    baseUrl: 'https://verdadabierta.com',
    articleLinkSelector: 'h2 a, h3 a, .entry-title a',
    articleFilter: (h) =>
      h.includes(verdadBase) && !h.includes('/category/') && !h.includes('/author/'),
  },
]

const indepazBase = 'indepaz.org.co'
const contagioBase = 'contagioradio.com'
const orillasBase = 'las2orillas.co'
const verdadBase = 'verdadabierta.com'

async function main() {
  const db = newKyselyPostgresql()
  let totalStored = 0

  // Generate archive URLs: Jan-Jun 2026
  const months: string[] = []
  for (let m = 1; m <= 6; m++) {
    months.push(`2026/${String(m).padStart(2, '0')}`)
  }

  const startUrls = SOURCES.flatMap((src) =>
    months.map((m) => `${src.baseUrl}/${m}/`),
  )

  console.log(`Starting crawl: ${startUrls.length} archive pages from ${SOURCES.length} sources\n`)

  const crawler = new CheerioCrawler({
    maxConcurrency: 2,
    maxRequestsPerCrawl: 500,

    async requestHandler({ $, request, log }) {
      // Extract article links from archive page
      // Find which source this URL belongs to
      const src = SOURCES.find((s) => request.url.startsWith(s.baseUrl))
      if (!src) return

      const links = $(src.articleLinkSelector)
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(Boolean)
        .map((href) => {
          const h = href as string
          return h.startsWith('http') ? h : `${src.baseUrl}${h.startsWith('/') ? '' : '/'}${h}`
        })
        .filter((url) => (src.articleFilter ? src.articleFilter(url) : true))

      const uniqueLinks = [...new Set(links)]
      log.info(`${request.url}: ${uniqueLinks.length} article links`)

      // For each article link, fetch and store
      for (const articleUrl of uniqueLinks.slice(0, 10)) {
        // Skip if already in DB
        const exists = await db
          .selectFrom('source')
          .select('id')
          .where('url', '=', articleUrl)
          .executeTakeFirst()
        if (exists) continue

        try {
          // Use crawlee's built-in request to fetch article page
          const articleReq = await crawler.addRequests([
            { url: articleUrl, uniqueKey: articleUrl, label: 'article' },
          ])
        } catch {
          // Skip if can't add
        }
      }
    },
  })

  // Article detail handler
  crawler.router.addHandler('article', async ({ $, request, log }) => {
    try {
      // Find which source
      const src = SOURCES.find((s) => request.url.startsWith(s.baseUrl))
      const mediumName = src?.name || 'Unknown'

      // Extract content
      const title =
        $('h1.entry-title').first().text().trim() ||
        $('h1').first().text().trim() ||
        ''
      const dateStr =
        $('time.entry-date').first().attr('datetime') ||
        $('time').first().attr('datetime') ||
        $('time.entry-date').first().text().trim() ||
        ''

      // Try multiple body selectors
      let bodyText = ''
      for (const sel of [
        'div.entry-content',
        'article .content',
        'article',
        'div.post-content',
        'main',
      ]) {
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
      if (date && date < CUTOFF) return

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
          metadata: JSON.stringify({ region: 'Colombia' }),
          is_relevant: isRelevant,
          classification_reason: reason,
        })
        .execute()

      log.info(`  ✅ ${title.slice(0, 70)} (${cleanText.length} chars)`)
    } catch (err) {
      // skip
    }
  })

  await crawler.run(startUrls)

  const count = await db
    .selectFrom('source')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .executeTakeFirst()
  console.log(`\n✅ Total sources in DB: ${count?.c || 0}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
