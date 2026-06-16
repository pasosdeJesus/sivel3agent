import axios from 'axios'
import { parse as parseHTML } from 'node-html-parser'
import fs from 'fs'

interface GoldenCase {
  id_relato: string
  titulo: string
  fecha: string
  hechos: string
  fuente_url: string
  fuente_nombre: string
  fuente_texto?: string
}

function cleanText(html: string): string {
  const root = parseHTML(html)
  root.querySelectorAll('script, style, nav, footer, .comments, .sidebar, .widget, .related-posts, .share-buttons, .author-box').forEach(el => el.remove())
  let text = root.textContent || ''
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

// Selector for article body varies by site
const SELECTORS: Record<string, string> = {
  'Infobae': 'article, .article-body, .entry-content, .story-content, [class*="article"]',
  'Comisión Intereclesial de Justicia y Paz': 'div.entry-content, article',
  'MiPutumayo Noticias': 'div.entry-content, article',
  'Human Rights Watch': 'article, .body-content, .rich-text, [class*="content"]',
  'W Radio': 'article, .article-body, .entry-content, .story-body',
  'La Silla Vacía': 'article, .entry-content, .article-content, .post-content',
}

const cases: GoldenCase[] = [
  {
    id_relato: '171316',
    titulo: 'Asesinan a exalcalde de Mocoa',
    fecha: '2025-01-04',
    hechos: '',
    fuente_url: 'https://www.infobae.com/colombia/2025/01/05/las-hipotesis-que-manejan-las-autoridades-sobre-el-asesinato-del-exalcalde-de-mocoa-elver-ceron-tenia-unas-deudas/',
    fuente_nombre: 'Infobae',
  },
  {
    id_relato: '171587',
    titulo: 'Sujetos armados en resguardo Nasa - Villagarzón',
    fecha: '2025-02-04',
    hechos: '',
    fuente_url: 'https://www.justiciaypazcolombia.com/informe-presencia-de-sujetos-armados-en-comunidad-del-pueblo-nasa-villa-garzon-putumayo/',
    fuente_nombre: 'Comisión Intereclesial de Justicia y Paz',
  },
  {
    id_relato: '171588',
    titulo: 'Nuevo ingreso de armados a resguardo Nasa - Villagarzón',
    fecha: '2025-02-06',
    hechos: '',
    fuente_url: 'https://www.justiciaypazcolombia.com/informe-de-nuevo-sujetos-armados-ingresan-en-el-resguardo-indigena-nasa-de-villagarzon-putumayo/',
    fuente_nombre: 'Comisión Intereclesial de Justicia y Paz',
  },
  {
    id_relato: '171308',
    titulo: 'Asesinan a taxista en vía Agua Clara - San Miguel',
    fecha: '2025-03-24',
    hechos: '',
    fuente_url: 'https://miputumayo.com.co/2025/03/24/asesinan-a-taxista-en-la-via-agua-clara-san-miguel/',
    fuente_nombre: 'MiPutumayo Noticias',
  },
  {
    id_relato: '172381',
    titulo: 'Grupos armados someten a comunidades en Putumayo',
    fecha: '2025-04-01',
    hechos: '',
    fuente_url: 'https://www.hrw.org/es/news/2025/12/05/colombia-los-grupos-armados-someten-a-las-comunidades-en-putumayo',
    fuente_nombre: 'Human Rights Watch',
  },
  {
    id_relato: '171388',
    titulo: 'Asesinan a exconcejal y líder social en Orito',
    fecha: '2025-04-27',
    hechos: '',
    fuente_url: 'https://www.wradio.com.co/2025/04/29/asesinan-a-exconcejal-y-lider-social-wilmer-yair-lopez-en-orito-putumayo/',
    fuente_nombre: 'W Radio',
  },
  {
    id_relato: '171405',
    titulo: 'Asesinan a dos líderes sociales en Putumayo',
    fecha: '2025-05-01',
    hechos: '',
    fuente_url: 'https://www.lasillavacia.com/silla-amazonia/amazonia-en-breve/asesinan-a-dos-lideres-sociales-en-putumayo/',
    fuente_nombre: 'La Silla Vacía',
  },
]

async function scrape() {
  for (const c of cases) {
    console.log(`\nScraping: ${c.fuente_nombre} — ${c.id_relato}`)
    console.log(`  ${c.fuente_url}`)

    try {
      const { data } = await axios.get(c.fuente_url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      const selector = SELECTORS[c.fuente_nombre] || 'article'
      const root = parseHTML(data)
      const body = root.querySelector(selector)

      if (body) {
        c.fuente_texto = cleanText(body.innerHTML)
        console.log(`  ✅ ${c.fuente_texto.length} chars`)
      } else {
        // Fallback: try common selectors
        for (const sel of ['article', 'div.entry-content', 'div.post-content', 'main', 'body']) {
          const el = root.querySelector(sel)
          if (el) {
            c.fuente_texto = cleanText(el.innerHTML)
            console.log(`  ⚠️ Fallback selector '${sel}': ${c.fuente_texto.length} chars`)
            break
          }
        }
        if (!c.fuente_texto) {
          console.log(`  ❌ No body found`)
        }
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err}`)
    }

    // Be respectful
    await new Promise(r => setTimeout(r, 1000))
  }

  const outPath = process.argv[2] || 'test/golden-dataset.json'
  fs.mkdirSync('test', { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(cases, null, 2))
  console.log(`\n✅ Written ${cases.length} cases to ${outPath}`)
}

scrape().catch(console.error)
