import { fetchRSSFeed } from './scrape-news'

async function testFeed(url: string, medium: string) {
  const articles = await fetchRSSFeed({ url, medium, region: 'test' })
  console.log(`Found ${articles.length} articles in date range`)
  if (articles[0]) {
    console.log('First article:', {
      title: articles[0].title,
      url: articles[0].url,
      publishedAt: articles[0].publishedAt,
      medium: articles[0].medium,
    })
  }
}

const url = process.argv[2]
const medium = process.argv[3] || 'Test'
if (!url) {
  console.error('Usage: pnpm tsx scripts/test-feed.ts <RSS_URL> [medium]')
  process.exit(1)
}
testFeed(url, medium).catch(console.error)
