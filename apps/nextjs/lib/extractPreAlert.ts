import { keccak256, toBytes } from 'viem'

const LLM_URL = process.env.LLM_URL || 'http://localhost:11434/api/generate'
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b-instruct-q4_K_M'

interface News {
  title: string
  date: string
  text: string
  sourceUrl: string
  sourceMedium: string
}

export interface PreAlertResult {
  json: object
  eventHash: string
}

export async function extractPreAlert(
  news: News,
  maxRetries = 2,
): Promise<PreAlertResult> {
  const prompt = buildExtractionPrompt(news)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const jsonText = await callLLM(prompt)
      const cleaned = jsonText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
      const preAlertJson = JSON.parse(cleaned)
      const eventHash = keccak256(toBytes(JSON.stringify(preAlertJson)))
      return { json: preAlertJson, eventHash }
    } catch (err) {
      if (attempt === maxRetries) throw err
      console.warn(`LLM JSON parse failed (attempt ${attempt + 1}), retrying…`)
    }
  }
  throw new Error('extractPreAlert: max retries exceeded')
}

function buildExtractionPrompt(news: News): string {
  return `
Eres un experto en documentación de violencia política en Colombia y Palestina.
Extrae la siguiente información de esta noticia en formato JSON.
Sigue el esquema de \`doc/relato.schema.json\`.
NO inventes información. Si un campo no aparece, omítelo.

Título: ${news.title}
Fecha: ${news.date}
Fuente: ${news.sourceMedium} (${news.sourceUrl})
Texto: ${news.text}

Devuelve SOLO el JSON, sin explicaciones ni markdown.
  `
}

async function callLLM(prompt: string): Promise<string> {
  const response = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.2, top_p: 0.9 },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText}`,
    )
  }

  const data = (await response.json()) as { response: string }
  return data.response
}
