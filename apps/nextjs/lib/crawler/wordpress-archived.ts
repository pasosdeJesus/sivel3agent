import axios from 'axios'
import { parse as parseHTML } from 'node-html-parser'
import { createHash } from 'crypto'

export interface WordPressSource {
  name: string
  baseUrl: string
  region: string
  selectors: {
    list: string
    title: string
    date: string
    body: string
  }
}

export interface CrawledArticle {
  url: string
  title: string
  date: Date | null
  fullText: string
  medium: string
  region: string
  contentHash: string
}

export interface CrawlProgress {
  lastMonth: string // 'YYYY-MM'
  lastPage: number
  totalProcessed: number
}

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function cleanHTML(html: string): string {
  const root = parseHTML(html)
  root
    .querySelectorAll('script, style, nav, footer, .comments, .sidebar, .widget, .related-posts, .share-buttons, .author-box, .advertisement, .social-share')
    .forEach((el) => el.remove())
  let text = root.textContent || ''
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function monthsFrom(startYear: number, startMonth: number): string[] {
  const now = new Date()
  const months: string[] = []
  const endY = now.getFullYear()
  const endM = now.getMonth() + 1

  for (let y = startYear; y <= endY; y++) {
    const mStart = y === startYear ? startMonth : 1
    const mEnd = y === endY ? endM : 12
    for (let m = mStart; m <= mEnd; m++) {
      months.push(`${y}/${String(m).padStart(2, '0')}`)
    }
  }
  return months
}

async function fetchPage(url: string): Promise<string> {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': USER_AGENT },
  })
  return data
}

async function fetchArticlePage(
  url: string,
  source: WordPressSource,
): Promise<{ title: string; date: Date | null; fullText: string } | null> {
  try {
    const html = await fetchPage(url)
    const root = parseHTML(html)

    const titleEl = root.querySelector(source.selectors.title)
    const dateEl = root.querySelector(source.selectors.date)
    const bodyEl = root.querySelector(source.selectors.body)

    if (!titleEl) return null

    const title = titleEl.textContent?.trim() || ''
    const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim()
    const date = dateStr ? new Date(dateStr) : null
    const fullText = bodyEl ? cleanHTML(bodyEl.innerHTML) : cleanHTML(html)

    return { title, date, fullText }
  } catch {
    return null
  }
}

export async function crawlWordPressSource(
  source: WordPressSource,
  progress?: CrawlProgress,
): Promise<{ articles: CrawledArticle[]; progress: CrawlProgress }> {
  const articles: CrawledArticle[] = []
  const startMonth = progress?.lastMonth || '2026/01'
  const [startY, startM] = startMonth.split('/').map(Number)
  const months = monthsFrom(startY, startM)
  let lastMonth = ''
  let lastPage = progress?.lastPage || 1
  let totalProcessed = progress?.totalProcessed || 0

  for (const month of months) {
    lastMonth = month
    const archiveUrl = `${source.baseUrl}/${month}/`
    console.log(`  📅 ${month} — ${archiveUrl}`)

    let page = lastPage
    let hasMore = true

    while (hasMore) {
      const pageUrl = page === 1 ? archiveUrl : `${archiveUrl}page/${page}/`
      try {
        const html = await fetchPage(pageUrl)
        const root = parseHTML(html)
        const links = root.querySelectorAll(source.selectors.list)

        if (links.length === 0) {
          hasMore = false
          break
        }

        for (const link of links) {
          const href = link.getAttribute('href')
          if (!href) continue

          // Resolve relative URLs
          const fullUrl = href.startsWith('http') ? href : `${source.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`

          // Avoid non-article URLs (category pages, author pages, etc.)
          if (
            fullUrl.includes('/category/') ||
            fullUrl.includes('/author/') ||
            fullUrl.includes('/tag/') ||
            fullUrl.includes('/page/') ||
            fullUrl === source.baseUrl ||
            fullUrl === source.baseUrl + '/'
          ) {
            continue
          }

          const article = await fetchArticlePage(fullUrl, source)
          if (!article) continue

          const contentHash = createHash('sha256')
            .update(article.fullText)
            .digest('hex')

          articles.push({
            url: fullUrl,
            title: article.title,
            date: article.date,
            fullText: article.fullText,
            medium: source.name,
            region: source.region,
            contentHash,
          })

          totalProcessed++
        }

        console.log(`    page ${page}: ${links.length} links, total: ${totalProcessed}`)
        page++
        lastPage = page

        // Rate limit
        await new Promise((r) => setTimeout(r, 500))
      } catch (err) {
        console.warn(`    ❌ ${pageUrl}: ${err instanceof Error ? err.message : err}`)
        hasMore = false
      }
    }
    lastPage = 1 // reset for next month
  }

  return {
    articles,
    progress: { lastMonth, lastPage, totalProcessed },
  }
}
