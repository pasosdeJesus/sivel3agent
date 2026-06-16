import fs from 'fs'
import { extractPreAlert } from '../lib/extractPreAlert'

const LLM_URL = process.env.LLM_URL || 'http://localhost:11434/api/generate'

interface GoldenCase {
  id_relato: string
  titulo: string
  fecha: string
  hechos: string
  fuente_url: string
  fuente_nombre: string
  fuente_texto: string
  // Expected fields from Banco de Datos annotation
  expected_agresion?: string   // e.g. "ASESINATO (40)"
  expected_departamento?: string
  expected_municipio?: string
  expected_grupos?: string[]
  expected_contextos?: string[]
  expected_victimas_count?: number
}

interface ModelResult {
  model: string
  total: number
  validJson: number
  agresionMatch: number
  deptoMatch: number
  municipioMatch: number
  grupoMatch: number
  contextMatch: number
  avgTime: number
  avgRetries: number
  avgOutputLen: number
  errors: string[]
}

const MODELS = [
  'qwen2.5:1.5b-instruct-q4_K_M',
  'qwen2.5:3b-instruct-q4_K_M',
  'qwen2.5:7b-instruct-q4_K_M',
  'qwen2.5:14b-instruct-q4_K_M',
  'qwen2.5-coder:14b',
]

function loadGoldenDataset(): GoldenCase[] {
  const raw = JSON.parse(fs.readFileSync('test/golden-dataset.json', 'utf-8'))
  // Add expected annotations from the Banco de Datos XML
  const annotations: Record<string, Partial<GoldenCase>> = {
    '171316': {
      expected_agresion: 'ASESINATO (40)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Mocoa',
      expected_grupos: ['Sin Información'],
      expected_contextos: ['PARAMILITARIZACIÓN', 'PRESENCIA GUERRILLERA', 'ENCLAVES ECONÓMICOS'],
      expected_victimas_count: 2,
    },
    '171587': {
      expected_agresion: 'COLECTIVO AMENAZADO (49)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Villagarzón',
      expected_contextos: ['MILITARIZACIÓN', 'PARAMILITARIZACIÓN', 'PRESENCIA GUERRILLERA'],
      expected_victimas_count: 100,
    },
    '171588': {
      expected_agresion: 'AMENAZA (45)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Villagarzón',
      expected_grupos: ['Sin Información'],
      expected_contextos: ['MILITARIZACIÓN', 'PARAMILITARIZACIÓN', 'PRESENCIA GUERRILLERA'],
      expected_victimas_count: 1,
    },
    '171308': {
      expected_agresion: 'ASESINATO (40)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'San Miguel',
      expected_grupos: ['COMANDOS DE LA FRONTERA'],
      expected_contextos: ['PARAMILITARIZACIÓN', 'PRESENCIA GUERRILLERA'],
      expected_victimas_count: 1,
    },
    '172381': {
      expected_agresion: 'DESPLAZAMIENTO FORZADO COLECTIVO (102)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Puerto Leguízamo',
      expected_grupos: ['FRENTE CAROLINA RAMÍREZ', 'Disidencias FARC-EP'],
      expected_contextos: ['CONFLICTO ARMADO', 'PRESENCIA GUERRILLERA'],
    },
    '171388': {
      expected_agresion: 'ASESINATO (40)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Orito',
      expected_contextos: ['PARAMILITARIZACIÓN', 'PRESENCIA GUERRILLERA'],
      expected_victimas_count: 1,
    },
    '171405': {
      expected_agresion: 'ASESINATO (40)',
      expected_departamento: 'Putumayo',
      expected_municipio: 'Puerto Caicedo',
      expected_victimas_count: 2,
    },
  }
  for (const c of raw) {
    Object.assign(c, annotations[c.id_relato] || {})
  }
  return raw as GoldenCase[]
}

function normalizeCode(s: string): string {
  // Normalize CINEP codes: "ASESINATO (40)" or "B40: ASESINATO POLÍTICO..." → "40"
  const match = s.match(/\(?(\d{2,3})\)?/)
  return match ? match[1] : s.toLowerCase().trim()
}

function matchAgresion(actual: string | undefined, expected: string | undefined): boolean {
  if (!actual || !expected) return false
  const aNorm = normalizeCode(actual)
  const eNorm = normalizeCode(expected)
  return aNorm === eNorm
}

function matchContextos(actual: string[] | undefined, expected: string[] | undefined): number {
  if (!actual || !expected || expected.length === 0) return 0
  const aUpper = actual.map(s => s.toUpperCase().trim())
  const eUpper = expected.map(s => s.toUpperCase().trim())
  const matches = eUpper.filter(e => aUpper.some(a => a.includes(e) || e.includes(a)))
  return matches.length / expected.length
}

async function evaluateModel(model: string, dataset: GoldenCase[]): Promise<ModelResult> {
  const result: ModelResult = {
    model,
    total: dataset.length,
    validJson: 0,
    agresionMatch: 0,
    deptoMatch: 0,
    municipioMatch: 0,
    grupoMatch: 0,
    contextMatch: 0,
    avgTime: 0,
    avgRetries: 0,
    avgOutputLen: 0,
    errors: [],
  }

  let totalTime = 0
  let totalRetries = 0
  let totalOutputLen = 0

  for (const c of dataset) {
    const text = c.fuente_texto
    if (!text || text.length < 50) {
      result.errors.push(`${c.id_relato}: text too short (${text?.length || 0} chars)`)
      continue
    }

    const start = Date.now()
    let retries = 0
    let json: Record<string, unknown> | null = null

    while (retries <= 2) {
      try {
        // Use the same API as extractPreAlert but with specific model
        const prompt = buildEvalPrompt(c, text)
        const resp = await fetch(LLM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: { temperature: 0.0, top_p: 0.9 },
          }),
        })
        if (!resp.ok) throw new Error(`Ollama ${resp.status}`)
        const data = (await resp.json()) as { response: string }
        const rawJson = data.response

        // Parse JSON robustly
        const cleaned = rawJson
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```[\s\S]*$/m, '')
          .trim()
        const firstBrace = cleaned.indexOf('{')
        if (firstBrace === -1) throw new Error('No JSON')
        const candidate = cleaned.slice(firstBrace)
        let depth = 0
        let end = -1
        for (let i = 0; i < candidate.length; i++) {
          if (candidate[i] === '{') depth++
          if (candidate[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
        }
        if (end === -1) throw new Error('Unbalanced braces')
        json = JSON.parse(candidate.slice(0, end))
        totalOutputLen += rawJson.length
        break
      } catch {
        retries++
        if (retries > 2) {
          result.errors.push(`${c.id_relato}: JSON parse failed after ${retries} retries`)
          json = null
          break
        }
      }
    }

    totalTime += Date.now() - start
    totalRetries += retries

    if (!json) continue

    result.validJson++

    // Extract relato (first one if array)
    const relatos = json.relatos as unknown[]
    const relato = (relatos && relatos[0]) ? relatos[0] as Record<string, unknown> : json

    // Agresión
    const agresion = (relato.agresion_particular || relato.actos?.[0]?.agresion_particular) as string | undefined
    if (matchAgresion(agresion, c.expected_agresion)) {
      result.agresionMatch++
    }

    // Departamento
    if (c.expected_departamento) {
      const depto = (relato.departamento as string || '')?.toUpperCase().trim()
      if (depto === c.expected_departamento.toUpperCase()) result.deptoMatch++
    }

    // Municipio
    if (c.expected_municipio) {
      const mun = (relato.municipio as string || '')?.toUpperCase().trim()
      if (mun === c.expected_municipio.toUpperCase()) result.municipioMatch++
    }

    // Grupos
    if (c.expected_grupos && c.expected_grupos.length > 0) {
      const grupos = (relato.grupos as Array<{ nombre_grupo?: string }> || [])
      const nombres = grupos.map(g => (g.nombre_grupo || '').toUpperCase().trim())
      const anyMatch = c.expected_grupos.some(eg =>
        nombres.some(n => n.includes(eg.toUpperCase()) || eg.toUpperCase().includes(n))
      )
      if (anyMatch) result.grupoMatch++
    }

    // Contextos
    if (c.expected_contextos && c.expected_contextos.length > 0) {
      const ctx = relato.contextos as string[] | undefined
      result.contextMatch += matchContextos(ctx, c.expected_contextos)
    }
  }

  const n = result.validJson || 1
  result.avgTime = totalTime / dataset.length / 1000
  result.avgRetries = totalRetries / dataset.length
  result.avgOutputLen = totalOutputLen / dataset.length
  // Normalize contextMatch to count
  result.contextMatch = Math.round(result.contextMatch)

  return result
}

function buildEvalPrompt(c: GoldenCase, text: string): string {
  return `
Eres un experto del Banco de Datos del CINEP (Noche y Niebla). Convierte esta noticia en un relato JSON.
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
    "agresion_particular": "CÓDIGO EXACTO de la lista de clasificación",
    "contextos": ["Uno o dos de la lista de CONTEXTO"],
    "victimas": [{
      "ocupacion": "OCUPACIÓN de la lista",
      "estado": "muerto, herido, desaparecido, desplazado, amenazado"
    }],
    "grupos": [{"nombre_grupo": "NOMBRE EN MAYÚSCULAS"}],
    "presuntos_responsables_individuales": [{"nombre": "NOMBRE EN MAYÚSCULAS"}],
    "cantidad": {"muertos": N, "heridos": N, "desplazados": N},
    "fuentes": [{"nombre_fuente": "${c.fuente_nombre}", "fecha": "${c.fecha}", "ubicacion": "${c.fuente_url}"}]
  }]
}

Noticia (${c.fuente_nombre}, ${c.fecha}):
Título: ${c.titulo}
${text.slice(0, 6000)}
  `
}

async function main() {
  const dataset = loadGoldenDataset()
  console.log(`Golden dataset: ${dataset.length} cases\n`)

  const results: ModelResult[] = []

  for (const model of MODELS) {
    console.log(`\n🔍 Evaluating ${model}...`)
    try {
      const r = await evaluateModel(model, dataset)
      results.push(r)

      console.log(`  Valid JSON: ${r.validJson}/${r.total}`)
      console.log(`  Agresión match: ${r.agresionMatch}/${r.total}`)
      console.log(`  Depto match: ${r.deptoMatch}/${r.total}`)
      console.log(`  Municipio match: ${r.municipioMatch}/${r.total}`)
      console.log(`  Grupo match: ${r.grupoMatch}/${r.total}`)
      console.log(`  Context match: ${r.contextMatch}/${r.total}`)
      console.log(`  Avg time: ${r.avgTime.toFixed(1)}s`)
      console.log(`  Avg retries: ${r.avgRetries.toFixed(1)}`)
      if (r.errors.length) {
        console.log(`  Errors: ${r.errors.join(', ')}`)
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err}`)
    }
  }

  // Scoring
  const maxTime = Math.max(...results.map(r => r.avgTime), 0.1)
  const maxLen = Math.max(...results.map(r => r.avgOutputLen), 1)

  const scored = results.map(r => {
    const n = r.total || 1
    const scorePrecision = ((r.agresionMatch / n) * 0.40 + (r.deptoMatch / n) * 0.15 + (r.municipioMatch / n) * 0.10 + (r.grupoMatch / n) * 0.10 + (r.contextMatch / n) * 0.05) * 100
    const scoreJSON = (r.validJson / n) * 10
    const scorePath = Math.max(0, 10 - r.avgRetries * 3 - Math.max(0, (r.avgOutputLen / maxLen - 1)) * 5)
    const scoreSpeed = Math.max(0, (1 - r.avgTime / maxTime) * 5)
    const overall = scorePrecision + scoreJSON + scorePath + scoreSpeed
    return { ...r, scorePrecision, scoreJSON, scorePath, scoreSpeed, overall }
  })

  console.log('\n🏆 FINAL RANKING')
  console.log('='.repeat(80))
  const sorted = scored.sort((a, b) => b.overall - a.overall)
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]
    console.log(`${i + 1}. ${s.model.padEnd(35)} ${s.overall.toFixed(1)}%  (prec:${s.scorePrecision.toFixed(1)} json:${s.scoreJSON.toFixed(1)} path:${s.scorePath.toFixed(1)} speed:${s.scoreSpeed.toFixed(1)})`)
  }

  const best = sorted[0]
  console.log(`\n✅ Best model: ${best.model} (${best.overall.toFixed(1)}%)`)
  console.log(`   Agresión accuracy: ${best.agresionMatch}/${best.total} (${((best.agresionMatch/best.total)*100).toFixed(0)}%)`)
  console.log(`   JSON validity: ${best.validJson}/${best.total}`)

  fs.writeFileSync('evaluation-results.json', JSON.stringify(sorted, null, 2))
  console.log('\n📄 Results saved to evaluation-results.json')
}

main().catch(console.error)
