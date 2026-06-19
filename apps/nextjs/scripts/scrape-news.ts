import Parser from 'rss-parser'
import { parse as parseHTML } from 'node-html-parser'
import { createHash } from 'crypto'
import axios from 'axios'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { classifyByKeywords } from '../lib/classifyByKeywords'
import { classifyNewsLLM } from '../lib/classifyNewsLLM'

interface FeedConfig {
  url: string
  medium: string
  region: string
}

const RSS_FEEDS: FeedConfig[] = [
  { url: 'https://indepaz.org.co/feed/', medium: 'INDEPAZ', region: 'Colombia' },
  { url: 'https://www.eltiempo.com/rss/justicia_conflicto-y-narcotrafico.xml', medium: 'El Tiempo', region: 'Colombia' },
  { url: 'https://www.hrw.org/rss/news', medium: 'HRW', region: 'Colombia' },
  { url: 'https://reliefweb.int/updates/rss.xml?search=primary_country.iso3:PSE', medium: 'ReliefWeb', region: 'Palestine' },
  { url: 'https://miputumayo.com.co/feed/', medium: 'MiPutumayo Noticias', region: 'Putumayo' },
  { url: 'https://verdadabierta.com/feed/', medium: 'Verdad Abierta', region: 'Colombia' },
  { url: 'https://www.justiciaypazcolombia.com/feed/', medium: 'Comisión Intereclesial', region: 'Colombia' },
  { url: 'https://prensarural.org/spip/spip.php?page=backend', medium: 'Prensa Rural', region: 'Colombia' },
  { url: 'https://www.contagioradio.com/feed/', medium: 'Contagio Radio', region: 'Colombia' },
  { url: 'https://www.las2orillas.co/feed/', medium: 'Las2Orillas', region: 'Colombia' },
  { url: 'https://www.larepublica.co/feed/', medium: 'La República', region: 'Colombia' },
  { url: 'https://www.elheraldo.co/feed/', medium: 'El Heraldo', region: 'Colombia' },
  { url: 'https://www.larazon.co/feed/', medium: 'La Razón', region: 'Colombia' },
  { url: 'https://voragine.co/feed/', medium: 'Vorágine', region: 'Colombia' },
  { url: 'https://mutante.org/feed/', medium: 'Mutante', region: 'Colombia' },
]

const START_DATE = new Date('2025-07-01')
const END_DATE = new Date()

interface Article {
  url: string
  medium: string
  title: string
  publishedAt: Date
  rawContent: string
  cleanText: string
  contentHash: string
}

async function fetchFullArticle(url: string): Promise<string> {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const root = parseHTML(data)

    // Try common article body selectors
    for (const sel of [
      'div.entry-content',
      'article .content',
      'article',
      'div.post-content',
      'div.article-body',
      'div.article-content',
      'main article',
      'main',
    ]) {
      const el = root.querySelector(sel)
      if (el) {
        el.querySelectorAll('script, style, nav, footer, .comments, .sidebar, .widget, .share-buttons').forEach((e) => e.remove())
        const text = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (text.length > 300) return text
      }
    }
    return ''
  } catch {
    return ''
  }
}

async function fetchRSSFeed(feedConfig: FeedConfig): Promise<Article[]> {
  const parser = new Parser()
  const feed = await parser.parseURL(feedConfig.url)

  const articles: Article[] = []

  for (const item of feed.items) {
    const pubDate = item.pubDate ? new Date(item.pubDate) : null

    if (!pubDate || pubDate < START_DATE || pubDate > END_DATE) {
      continue
    }

    // WordPress/SPIP: content:encoded is exposed as content by rss-parser
    const rawContent =
      (item as Record<string, unknown>)['content:encoded'] as string ||
      item.content ||
      item.description ||
      ''

    let cleanText = cleanHTML(rawContent)

    // If RSS only gave a short excerpt, fetch the full article
    if (cleanText.length < 500 && item.link) {
      const fullText = await fetchFullArticle(item.link)
      if (fullText && fullText.length > cleanText.length) {
        cleanText = fullText
      }
    }
    const contentHash = createHash('sha256').update(cleanText).digest('hex')

    articles.push({
      url: item.link || '',
      medium: feedConfig.medium,
      title: item.title || '',
      publishedAt: pubDate,
      rawContent,
      cleanText,
      contentHash,
    })
  }

  return articles
}

function cleanHTML(html: string): string {
  const root = parseHTML(html)
  root.querySelectorAll('script, style, nav, footer, .comments').forEach((el) => el.remove())
  let text = root.textContent || ''
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

async function saveAndClassify(
  article: Article,
  region: string,
): Promise<{ id: number | null; isRelevant: boolean | null }> {
  const db = newKyselyPostgresql()

  const existing = await db
    .selectFrom('source')
    .select('id')
    .where('url', '=', article.url)
    .executeTakeFirst()

  if (existing) {
    console.log(`  ⏭️  Skip (URL exists): ${article.title.slice(0, 80)}`)
    return { id: null, isRelevant: null }
  }

  const hashExisting = await db
    .selectFrom('source')
    .select('id')
    .where('content_hash', '=', article.contentHash)
    .executeTakeFirst()

  if (hashExisting) {
    console.log(`  ⏭️  Skip (hash exists): ${article.title.slice(0, 80)}`)
    return { id: null, isRelevant: null }
  }

  // Classify with keywords first
  const kw = classifyByKeywords(article.cleanText, article.title)

  let isRelevant: boolean
  let reason: string

  if (kw.confidence === 'high') {
    isRelevant = kw.relevant
    reason = `[kw] ${kw.reason}`
  } else {
    try {
      const llm = await classifyNewsLLM(article.cleanText, article.title)
      isRelevant = llm.relevant
      reason = `[llm] ${llm.reason}`
    } catch (err) {
      console.warn(`  ⚠️  LLM classify failed, using keyword fallback: ${err}`)
      isRelevant = kw.relevant
      reason = `[kw-fallback] ${kw.reason}`
    }
  }

  const result = await db
    .insertInto('source')
    .values({
      url: article.url,
      medium: article.medium,
      title: article.title,
      published_at: article.publishedAt,
      content_hash: article.contentHash,
      raw_content: article.rawContent,
      clean_text: article.cleanText,
      metadata: { region },
      is_relevant: isRelevant,
      classification_reason: reason,
    })
    .returning('id')
    .executeTakeFirst()

  const icon = isRelevant ? '✅' : '❌'
  console.log(`  ${icon} ${article.title.slice(0, 80)} → ${reason}`)

  return { id: result?.id || null, isRelevant }
}

async function scrapeAllFeeds() {
  console.log(`Starting scrape (${START_DATE.toISOString()} to ${END_DATE.toISOString()})\n`)

  let totalStored = 0
  let totalRelevant = 0

  for (const feed of RSS_FEEDS) {
    console.log(`📡 ${feed.medium} (${feed.region})`)
    try {
      const articles = await fetchRSSFeed(feed)
      console.log(`   ${articles.length} articles in date range`)

      for (const article of articles) {
        const result = await saveAndClassify(article, feed.region)
        if (result.id !== null) {
          totalStored++
          if (result.isRelevant) totalRelevant++
        }
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error)
    }
  }

  console.log(`\n✅ Done. Stored: ${totalStored}, Relevant: ${totalRelevant}`)
}

const isMain = process.argv[1]?.includes('scrape-news')
if (isMain) {
  scrapeAllFeeds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { scrapeAllFeeds, fetchRSSFeed, cleanHTML, saveAndClassify }
