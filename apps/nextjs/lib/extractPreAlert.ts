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
Convierte esta noticia en un relato JSON. Si el texto NO describe un hecho de violencia
política con víctimas, responde con un JSON vacío: {"relatos":[]}

## El acto de violencia es el elemento central
- Cada caso debe tener al menos un "acto" con "agresion_particular" (código del tesauro)
- SIN acto no hay caso → responde {"relatos":[]}
- La víctima se define por el acto, no por un campo "estado"
- Si no hay víctimas identificables, no hay caso

## Víctimas (Paso CRÍTICO)
- **Víctima individual:** nombre, ocupación, sector social. Si el nombre no aparece en el texto, usar "NN"
- **Víctima colectiva:** cuando el hecho afecta a una población entera (bloqueo de vías, paro armado, desplazamiento masivo, confinamiento). Ej: "POBLACIÓN DE EL CHARCO", "COMUNIDAD NASA DEL RESGUARDO X". En este caso usar "victimas" (colectivo) en vez de "personas"
- **Víctima NN:** si no hay identidad pero sí hay hecho, registrar con ocupación conocida y nombre "N", apellido "N"
- Para víctimas colectivas, NO poner ocupaciones individuales. Usar "descripcion": "Población civil afectada por bloqueo armado"
- El campo "personas" es para víctimas individuales identificadas (o NN)
- El campo "cantidad" debe reflejar números reales del texto. Si no se mencionan, usar 0.

## Clasificación (elige el código EXACTO de la lista)
El tipo de AUTOR determina la categoría:
- Autor ESTATAL/PARAESTATAL (Ejército, Policía, paramilitares, ESMAD) → A (DD.HH.)
- Autor NO ESTATAL con móvil POLÍTICO (guerrilla, ELN, disidencias FARC, Clan del Golfo, bandas criminales con control territorial, desconocidos con móvil político) → B (VPS)
- HECHO BÉLICO (combate, bombardeo, bloqueo de vías como táctica militar entre actores armados) → C (Acción Bélica)
- INFRACCIÓN AL DIH en conflicto armado (ataque indiscriminado a población civil, desplazamiento forzado como instrumento de guerra, hambre como método de guerra, confinamiento de poblaciones, muerte de civil en acción bélica, bloqueo de vías que afecta población civil) → D (DIHC)

Códigos del marco conceptual (elige UNO, el más preciso):
DDHH (A): A10:Ejecución Extrajudicial, A11:Desaparición Forzada, A12:Tortura, A13:Lesión Física, A14:Detención Arbitraria, A15:Amenaza Individual, A18:Amenaza Colectiva, A102:Desplazamiento Forzado Colectivo, A104:Confinamiento como Represalia
VPS (B): B40:Asesinato Político, B41:Secuestro, B45:Amenaza Individual, B49:Amenaza Colectiva, B401:Desplazamiento Forzado Colectivo
Bélica (C): C62:Combate, C63:Emboscada, C65:Bombardeo, C66:Bloqueo de Vías (táctica militar), C68:Incursión
DIHC (D): D90:Ataque Indiscriminado, D86:Hambre como Método de Guerra, D906:Confinamiento de Poblaciones como Instrumento de Guerra, D701:Homicidio Intencional de Persona Protegida, D703:Muerte de Civil en Acción Bélica, D903:Desplazamiento Forzado como Instrumento de Guerra, D72:Tortura y Tratos Crueles como Instrumento de Guerra, D74:Toma de Rehenes, D75:Reclutamiento de Menores

## Hechos que SÍ son caso
Ejecución, asesinato, desaparición, tortura, secuestro, amenaza, desplazamiento forzado, confinamiento, detención arbitraria, bloqueo de vías por actor armado, paro armado, ataque indiscriminado, bombardeo con víctimas civiles

## Hechos que NO son caso
Operativos militares sin víctimas civiles, capturas policiales, procesos judiciales, protestas sin violencia, análisis de coyuntura, destrucción de laboratorios de droga

## Redacción de "hechos"
- QUIÉN + QUÉ + A QUIÉN en tiempo pasado
- Verbos: ejecutaron, asesinaron, desplazaron, amenazaron, bloquearon, confinaron, bombardearon
- NO usar "dieron de baja" ni regionalismos
- Citas textuales entre comillas

## Tesauro de contextos
CONFLICTO ARMADO, ACCIONES BÉLICAS, PARAMILITARIZACIÓN, PRESENCIA GUERRILLERA, PERSECUCIÓN A ORGANIZACIÓN, MILITARIZACIÓN, CULTIVOS DE USO ILÍCITO, PROTESTA, MANIFESTACIONES, ENCLAVES ECONÓMICOS, PARO ARMADO, PROCESOS ELECTORALES, DESPLAZAMIENTO FORZADO, CONFINAMIENTO, BLOQUEO DE VÍAS

## Ocupación de víctimas
CAMPESINO, INDÍGENA, LIDER(ESA) SOCIAL, DEFENSOR/A DE DDHH, SINDICALISTA, PERIODISTA, MENOR DE EDAD, COMERCIANTE, ABOGADO/A, EXCONCEJAL, ALCALDE, SOLDADO, POLICÍA, EXCOMBATIENTE, DESPLAZADO, SERVIDOR PÚBLICO, SIN INFORMACIÓN

Responde SOLO este JSON (sin explicaciones, sin markdown). Si no hay caso, {"relatos":[]}:
{
  "relatos": [{
    "titulo": "máx 60 chars, resume el hecho concreto",
    "hechos": "responsable + acción + víctima + circunstancias en tiempo pasado. Citas textuales entre comillas.",
    "fecha": "YYYY-MM-DD",
    "departamento": "departamento o null",
    "municipio": "municipio o null",
    "centro_poblado": "vereda/corregimiento/barrio o null",
    "agresion_particular": "CÓDIGO EXACTO de la lista. Obligatorio si hay caso. Ej: A10:EJECUCIÓN EXTRAJUDICIAL (10)",
    "contextos": ["uno o dos del tesauro"],
    "personas": [{"nombre": "NOMBRES EN MAYÚSCULAS", "apellido": "APELLIDOS EN MAYÚSCULAS", "sexo": "M/F/S"}],
    "victimas": [{
      "ocupacion": "ocupación del tesauro o POBLACIÓN CIVIL para colectivas",
      "descripcion": "para víctimas colectivas: Población de X afectada por Y. Para individuales: omitir"
    }],
    "actos": [{
      "agresion": "VIDA, INTEGRIDAD, LIBERTAD u otro bien afectado",
      "agresion_particular": "CÓDIGO EXACTO de la lista. Obligatorio.",
      "id_victima_individual": "índice en personas (0, 1...) si es víctima individual. null si es colectiva",
      "id_victima_colectiva": "índice en victimas (0, 1...) si es víctima colectiva. null si es individual"
    }],
    "grupos": [{"nombre_grupo": "NOMBRE EN MAYÚSCULAS del grupo responsable. SOLO si se menciona explícitamente en el texto"}],
    "presuntos_responsables_individuales": [{"nombre": "NOMBRE EN MAYÚSCULAS. SOLO si aparece en el texto. NUNCA inventar nombres"}],
    "cantidad": {"muertos": N, "heridos": N, "desplazados": N},
    "fuentes": [{"nombre_fuente": "${news.sourceMedium}", "fecha": "${news.date}", "ubicacion": "${news.sourceUrl}"}]
  }]
}

NO inventes nombres, lugares ni fechas. Si el texto no especifica, usa null.
SOLO el JSON. Sin texto antes ni después.
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
      options: { temperature: 0.0, top_p: 0.9 },
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
