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
Eres un documentador del Banco de Datos del CINEP (Noche y Niebla).
Tu tarea es convertir esta noticia en un relato JSON siguiendo la metodología.

## Metodología de documentación

### Extracción de información (9 preguntas)
Responde en el JSON lo que el texto permita:
- ¿QUÉ? El hecho ocurrido
- ¿QUIÉN? El presunto responsable
- ¿CONTRA QUIÉN? La víctima (quién era, sector social)
- ¿CÓMO? Métodos, armas, modo
- ¿CUÁNDO? Fecha y hora
- ¿DÓNDE? Departamento, municipio, vereda
- COYUNTURA: Contexto regional, actores armados
- ¿POR QUÉ? Móviles
- LA OTRA VERSIÓN: Versiones contradictorias si las hay

### Clasificación del hecho
La categoría depende del TIPO DE AUTOR:
- Autor ESTATAL o PARAESTATAL (Ejército, Policía, paramilitares) → DD.HH. (códigos A)
- Autor NO ESTATAL con móvil POLÍTICO (guerrilla, disidencias) → VPS (códigos B)
- En medio de ACCIÓN BÉLICA (combates, bombardeos) → Acción Bélica (códigos C)
- En medio de CONFLICTO ARMADO con infracciones al DIH → DIHC (códigos D)

Códigos principales (elige el más preciso):
DDHH: A10:Ejecución Extrajudicial, A11:Desaparición Forzada, A12:Tortura,
  A13:Lesión Física, A14:Detención Arbitraria, A15:Amenaza Individual,
  A18:Amenaza Colectiva, A102:Desplazamiento Forzado Colectivo, A104:Confinamiento
VPS: B40:Asesinato Político, B41:Secuestro, B45:Amenaza Individual,
  B49:Amenaza Colectiva, B401:Desplazamiento Forzado Colectivo
Acción Bélica: C62:Combate, C65:Bombardeo, C66:Bloqueo de Vías, C68:Incursión
DIHC: D90:Ataque Indiscriminado, D701:Homicidio Persona Protegida,
  D703:Muerte Civil en Acción Bélica, D903:Desplazamiento Forzado como Instrumento de Guerra

### Redacción del memo (campo "hechos")
- Comenzar con QUIÉN + QUÉ + A QUIÉN (ej: "Paramilitares ejecutaron a...")
- Verbos en tiempo pasado: ejecutaron, asesinaron, desplazaron, amenazaron
- NO usar regionalismos ni expresiones calificativas
- NO usar "dieron de baja" ni términos militares coloquiales
- Orden: responsable → acción → víctima → circunstancias → coyuntura
- Citas textuales entre comillas

### Tesauro de contextos
CONFLICTO ARMADO, ACCIONES BÉLICAS, PARAMILITARIZACIÓN, PRESENCIA GUERRILLERA,
PERSECUCIÓN A ORGANIZACIÓN, MILITARIZACIÓN, CULTIVOS DE USO ILÍCITO,
PROTESTA, MANIFESTACIONES, ENCLAVES ECONÓMICOS, CAMPAÑAS DE INTOLERANCIA,
DESALOJOS, ABUSO POLICIAL, PARO ARMADO, PROCESOS ELECTORALES

### Ocupación de víctimas
CAMPESINO, INDIGENA, LIDER(ESA) SOCIAL, DEFENSOR/A DE DDHH, SINDICALISTA,
PERIODISTA, MENOR DE EDAD, COMERCIANTE, ABOGADO/A, EXCONCEJAL, ALCALDE,
SOLDADO, POLICÍA, EXCOMBATIENTE, DESPLAZADO, SERVIDOR PÚBLICO, SIN INFORMACIÓN

Responde SOLO este JSON (sin explicaciones, sin markdown):
{
  "relatos": [{
    "titulo": "máx 50 chars, describe el hecho",
    "hechos": "responsable + acción + víctima + circunstancias en tiempo pasado. Citas textuales entre comillas.",
    "fecha": "YYYY-MM-DD",
    "departamento": "departamento o null",
    "municipio": "municipio o null",
    "centro_poblado": "vereda/corregimiento/barrio o null",
    "agresion_particular": "CÓDIGO EXACTO de la lista. Ej: B40: ASESINATO POLÍTICO (VPS - Persecución Política)",
    "contextos": ["uno o dos del tesauro de contextos"],
    "victimas": [{
      "ocupacion": "ocupación del tesauro",
      "estado": "muerto, herido, desaparecido, desplazado, amenazado"
    }],
    "grupos": [{"nombre_grupo": "NOMBRE EN MAYÚSCULAS del grupo armado responsable"}],
    "presuntos_responsables_individuales": [{"nombre": "NOMBRE EN MAYÚSCULAS si se menciona"}],
    "cantidad": {"muertos": N, "heridos": N, "desplazados": N},
    "fuentes": [{"nombre_fuente": "${news.sourceMedium}", "fecha": "${news.date}", "ubicacion": "${news.sourceUrl}"}]
  }]
}

Noticia (${news.sourceMedium}, ${news.date}):
Título: ${news.title}
${news.text.slice(0, 6000)}
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
