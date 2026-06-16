import Parser from 'rss-parser'
import { parse as parseHTML } from 'node-html-parser'
import { createHash } from 'crypto'
import { newKyselyPostgresql } from '../.config/kysely.config.js'

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
]

const START_DATE = new Date('2025-07-01')
const END_DATE = new Date() // present

interface Article {
  url: string
  medium: string
  title: string
  publishedAt: Date
  rawContent: string
  cleanText: string
  contentHash: string
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

    const rawContent = item.content || item.description || ''
    const cleanText = cleanHTML(rawContent)
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
  root.querySelectorAll('script, style').forEach(el => el.remove())
  let text = root.textContent || ''
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

async function saveArticle(article: Article, region: string): Promise<number | null> {
  const db = newKyselyPostgresql()

  const existing = await db
    .selectFrom('source')
    .select('id')
    .where('url', '=', article.url)
    .executeTakeFirst()

  if (existing) {
    console.log(`Skipping duplicate (URL): ${article.url}`)
    return null
  }

  const hashExisting = await db
    .selectFrom('source')
    .select('id')
    .where('content_hash', '=', article.contentHash)
    .executeTakeFirst()

  if (hashExisting) {
    console.log(`Skipping duplicate (hash): ${article.url}`)
    return null
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
    })
    .returning('id')
    .executeTakeFirst()

  console.log(`Inserted: ${article.title} (ID: ${result?.id})`)
  return result?.id || null
}

async function scrapeAllFeeds() {
  console.log(`Starting scrape (${START_DATE.toISOString()} to ${END_DATE.toISOString()})`)

  for (const feed of RSS_FEEDS) {
    console.log(`Fetching ${feed.url}...`)
    try {
      const articles = await fetchRSSFeed(feed)
      console.log(`Found ${articles.length} articles in date range`)

      for (const article of articles) {
        await saveArticle(article, feed.region)
      }
    } catch (error) {
      console.error(`Error fetching ${feed.url}:`, error)
    }
  }

  console.log('Scrape completed.')
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

export { scrapeAllFeeds, fetchRSSFeed, cleanHTML, saveArticle }
