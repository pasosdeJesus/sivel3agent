import Parser from 'rss-parser'
import { parse as parseHTML } from 'node-html-parser'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import axios from 'axios'
import { parseStringPromise } from 'xml2js'
import { newKyselyPostgresql } from '../.config/kysely.config.js'
import { classifyByKeywords } from '../lib/classifyByKeywords'
import { classifyNewsLLM } from '../lib/classifyNewsLLM'

/**
 * RSS scraper for sivel3agent.
 *
 * Reads RSS feed URLs from config/sources.json (active section).
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/scrape-news.ts [SOURCE_NAME|URL_FRAGMENT]
 *
 * Environment variables:
 *   SCRAPE_FEED       Filter by medium name or URL substring (alternative to CLI arg)
 *   SCRAPE_START_DATE  Override START_DATE (default: 2025-07-01). Format: YYYY-MM-DD
 *   SCRAPE_END_DATE    Override END_DATE (default: now). Format: YYYY-MM-DD
 *   DOTENV_CONFIG_PATH Path to .env file (default: ../.env)
 *
 * Examples:
 *   # Scrape all active feeds from config/sources.json
 *   node_modules/.bin/tsx scripts/scrape-news.ts
 *
 *   # Scrape only INDEPAZ
 *   node_modules/.bin/tsx scripts/scrape-news.ts INDEPAZ
 *
 *   # Scrape a specific date range
 *   SCRAPE_START_DATE=2026-01-01 SCRAPE_END_DATE=2026-06-01 node_modules/.bin/tsx scripts/scrape-news.ts
 */

interface FeedConfig {
  url: string
  medium: string
  region: string
}

function loadRSSFeeds(): FeedConfig[] {
  const configPath = resolve(import.meta.dirname, '..', 'config', 'sources.json')
  const raw = readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw)
  if (!config.active || !Array.isArray(config.active)) {
    console.error('config/sources.json missing "active" array')
    process.exit(1)
  }
  return config.active.map((f: { name: string; url: string; region: string }) => ({
    url: f.url,
    medium: f.name,
    region: f.region,
  }))
}

const RSS_FEEDS = loadRSSFeeds()

const START_DATE = new Date(process.env.SCRAPE_START_DATE || '2025-07-01')
const END_DATE = new Date(process.env.SCRAPE_END_DATE || new Date().toISOString())

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
  // Try strict parser first
  try {
    return await fetchRSSFeedStrict(feedConfig)
  } catch (strictErr) {
    console.warn(`   ⚠️  rss-parser failed (${(strictErr as Error).message.slice(0, 60)}) → trying tolerant parser`)
    try {
      return await fetchRSSFeedTolerant(feedConfig)
    } catch (tolerantErr) {
      console.warn(`   ⚠️  tolerant parser also failed: ${(tolerantErr as Error).message.slice(0, 60)}`)
      return []
    }
  }
}

async function fetchRSSFeedStrict(feedConfig: FeedConfig): Promise<Article[]> {
  const parser = new Parser()
  const feed = await parser.parseURL(feedConfig.url)

  return buildArticles(feed.items as RSSItem[], feedConfig)
}

async function fetchRSSFeedTolerant(feedConfig: FeedConfig): Promise<Article[]> {
  const { data } = await axios.get(feedConfig.url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    responseType: 'text',
  })

  const parsed = await parseStringPromise(data, {
    explicitArray: false,
    mergeAttrs: true,
    normalize: true,
    strict: false,
  })

  const channel = parsed?.rss?.channel
  if (!channel) return []

  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []

  return buildArticles(items as RSSItem[], feedConfig)
}

interface RSSItem {
  title?: string
  link?: string | { _?: string; $?: { href?: string } }
  pubDate?: string
  'content:encoded'?: string
  content?: string
  description?: string
}

async function buildArticles(items: RSSItem[], feedConfig: FeedConfig): Promise<Article[]> {
  const articles: Article[] = []
  for (const item of items) {
    const pubDate = item.pubDate ? new Date(item.pubDate) : null

    if (!pubDate || pubDate < START_DATE || pubDate > END_DATE) {
      continue
    }

    // Resolve link: xml2js may nest it as { _: "url" } or { $: { href: "url" } }
    let link = ''
    if (typeof item.link === 'string') {
      link = item.link
    } else if (item.link && typeof item.link === 'object') {
      link = (item.link as Record<string, unknown>)._ as string ||
             ((item.link as Record<string, unknown>).$ as Record<string, string>)?.href || ''
    }

    const rawContent =
      item['content:encoded'] ||
      item.content ||
      item.description ||
      ''

    let cleanText = cleanHTML(rawContent)

    if (cleanText.length < 500 && link) {
      const fullText = await fetchFullArticle(link)
      if (fullText && fullText.length > cleanText.length) {
        cleanText = fullText
      }
    }
    const contentHash = createHash('sha256').update(cleanText).digest('hex')

    articles.push({
      url: link,
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

const scrapeDb = newKyselyPostgresql()

async function saveAndClassify(
  article: Article,
  region: string,
): Promise<{ id: number | null; isRelevant: boolean | null }> {
  const existing = await scrapeDb
    .selectFrom('source')
    .select('id')
    .where('url', '=', article.url)
    .executeTakeFirst()

  if (existing) {
    console.log(`  ⏭️  Skip (URL exists): ${article.title.slice(0, 80)}`)
    return { id: null, isRelevant: null }
  }

  const hashExisting = await scrapeDb
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

  const result = await scrapeDb
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
  const feedFilter = process.env.SCRAPE_FEED || process.argv[2]

  const feeds = feedFilter
    ? RSS_FEEDS.filter(
        (f) =>
          f.medium.toLowerCase() === feedFilter.toLowerCase() ||
          f.url.includes(feedFilter),
      )
    : RSS_FEEDS

  if (feedFilter && feeds.length === 0) {
    console.error(`❌ No feed matches "${feedFilter}". Available:`)
    for (const f of RSS_FEEDS) console.error(`   ${f.medium} — ${f.url}`)
    process.exit(1)
  }

  console.log(`Starting scrape (${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]})`)
  if (feedFilter) console.log(`Filter: ${feedFilter} (${feeds.length} feed(s) matched)\n`)
  else console.log(`All ${feeds.length} feeds\n`)

  let totalStored = 0
  let totalRelevant = 0

  for (const feed of feeds) {
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
