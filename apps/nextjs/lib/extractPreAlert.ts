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
        .replace(/```[\s\S]*$/m, '')
        .trim()
      // Find first valid JSON object
      const firstBrace = cleaned.indexOf('{')
      if (firstBrace === -1) throw new Error('No JSON object found')
      const candidate = cleaned.slice(firstBrace)
      // Find matching closing brace
      let depth = 0
      let end = -1
      for (let i = 0; i < candidate.length; i++) {
        if (candidate[i] === '{') depth++
        if (candidate[i] === '}') {
          depth--
          if (depth === 0) { end = i + 1; break }
        }
      }
      if (end === -1) throw new Error('No matching closing brace')
      const preAlertJson = JSON.parse(candidate.slice(0, end))
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
Eres un experto del Banco de Datos del CINEP. Convierte esta noticia en un relato JSON.
Solo incluye datos explícitos del texto. NO inventes.

CLASIFICACIÓN DEL HECHO (elige el código más preciso):
DDHH-Persecución: A10:Ejecución Extrajudicial, A11:Desaparición Forzada, A12:Tortura,
  A13:Lesión Física, A14:Detención Arbitraria, A15:Amenaza Individual,
  A18:Amenaza Colectiva, A102:Desplazamiento Forzado Colectivo, A104:Confinamiento
VPS-Persecución: B40:Asesinato Político, B41:Secuestro, B45:Amenaza Individual,
  B401:Desplazamiento Forzado
Acción Bélica: C62:Combate, C65:Bombardeo, C66:Bloqueo de Vías, C68:Incursión
DIHC: D90:Ataque Indiscriminado, D701:Homicidio Persona Protegida,
  D703:Muerte Civil en Acción Bélica, D72:Tortura Instrumento de Guerra,
  D75:Reclutamiento Menores, D903:Desplazamiento Forzado Instrumento de Guerra

CONTEXTO (elige 1-2): CONFLICTO ARMADO, ACCIONES BÉLICAS, PARAMILITARIZACIÓN,
  PRESENCIA GUERRILLERA, PERSECUCIÓN A ORGANIZACIÓN, MILITARIZACIÓN,
  PROTESTA, MANIFESTACIONES, ABUSO POLICIAL, PARO ARMADO

OCUPACIÓN VÍCTIMA: CAMPESINO, INDIGENA, LIDER(ESA) SOCIAL, DEFENSOR/A DE DDHH,
  SINDICALISTA, PERIODISTA, MENOR DE EDAD, COMERCIANTE, SOLDADO, POLICÍA,
  EXCOMBATIENTE, DESPLAZADO, SIN INFORMACIÓN

Responde SOLO este JSON (sin explicaciones, sin markdown, sin comillas en null):
{
  "relatos": [{
    "titulo": "máx 50 chars",
    "hechos": "3-6 oraciones: qué pasó, quiénes, dónde, cuándo",
    "fecha": "YYYY-MM-DD",
    "departamento": "departamento o null",
    "municipio": "municipio o null",
    "agresion_particular": "CÓDIGO EXACTO de la lista de clasificación (ej: B40: ASESINATO POLÍTICO (VPS - Persecución Política))",
    "contextos": ["Uno o dos de la lista de CONTEXTO"],
    "victimas": [{
      "ocupacion": "OCUPACIÓN de la lista",
      "estado": "muerto, herido, desaparecido, desplazado, amenazado"
    }],
    "grupos": [{"nombre_grupo": "NOMBRE EN MAYÚSCULAS"}],
    "presuntos_responsables_individuales": [{"nombre": "NOMBRE EN MAYÚSCULAS"}],
    "cantidad": {"muertos": N, "heridos": N, "desplazados": N},
    "fuentes": [{"nombre_fuente": "${news.sourceMedium}", "fecha": "${news.date}", "ubicacion": "${news.sourceUrl}"}]
  }]
}

Noticia (${news.sourceMedium}, ${news.date}):
Título: ${news.title}
${news.text}
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
