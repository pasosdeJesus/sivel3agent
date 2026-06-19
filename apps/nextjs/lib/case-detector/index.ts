import { classifyByKeywords } from '../classifyByKeywords'
import type { PreAlertResult } from '../extractPreAlert'

export interface CaseDetectionResult {
  isCase: boolean
  reason: string
  category?: string
  victimCount?: number
  json?: object
}

export async function detectCase(
  article: {
    title: string
    cleanText: string
  },
  extractFn: (article: {
    title: string
    date: string
    text: string
    sourceUrl: string
    sourceMedium: string
  }) => Promise<PreAlertResult>,
): Promise<CaseDetectionResult> {
  // 1. Fast keyword filter
  const quick = classifyByKeywords(article.cleanText, article.title)
  if (!quick.relevant) {
    return { isCase: false, reason: `[kw] ${quick.reason}` }
  }

  // 2. LLM extraction
  let json: Record<string, unknown>
  try {
    const result = await extractFn({
      title: article.title,
      date: '',
      text: article.cleanText,
      sourceUrl: '',
      sourceMedium: '',
    })
    json = result.json as Record<string, unknown>
  } catch (err) {
    return { isCase: false, reason: `LLM extraction failed: ${err instanceof Error ? err.message : err}` }
  }

  // 3. Validate: has relatos?
  const relatos = json.relatos as Array<Record<string, unknown>> | undefined
  const relato = relatos?.[0]
  if (!relato) {
    return { isCase: false, reason: 'No relatos in JSON output' }
  }

  // 4. Validate: has valid actos with agresion_particular?
  // A victim is defined by the act of violence (acto), not by a separate
  // "estado" field. The victim may be NN (nombre/identidad desconocida).
  // Priorities: A (DD.HH.), B (VPS), D (DIHC). C (Acción Bélica) is secondary.
  const actos = relato.actos as Array<Record<string, unknown>> | undefined
  const agresionParticular =
    (relato.agresion_particular as string) ||
    (actos?.[0]?.agresion_particular as string)

  if (!agresionParticular || agresionParticular === 'SIN INFORMACIÓN' || agresionParticular === 'null') {
    return { isCase: false, reason: 'No violence category (agresion_particular) found' }
  }

  // Require at least one acto with a valid aggression code
  const hasValidActo = actos && actos.length > 0 && actos.some((a: Record<string, unknown>) => {
    const ap = a.agresion_particular as string
    return ap && ap !== 'SIN INFORMACIÓN' && ap !== 'null'
  })
  if (!hasValidActo) {
    return { isCase: false, reason: 'No valid actos (agresion_particular) found' }
  }

  // 5. Validate: has victims? Victim exists because an acto links to them.
  // Check personas (individual victims linked via actos.id_victima_individual)
  // or victimas (collective). cantidad (muertos/heridos/desplazados) also counts.
  const victimas = relato.victimas as Array<Record<string, unknown>> | undefined
  const personas = json.personas as Array<Record<string, unknown>> | undefined
  const cantidad = relato.cantidad as Record<string, number> | undefined

  const hasVictims =
    (victimas && victimas.length > 0) ||
    (personas && personas.length > 0) ||
    (cantidad && ((cantidad.muertos || 0) > 0 || (cantidad.heridos || 0) > 0 || (cantidad.desplazados || 0) > 0))

  if (!hasVictims) {
    return { isCase: false, reason: 'No victims found (individual or collective)' }
  }

  if (!hasVictims) {
    return { isCase: false, reason: 'No victims found (individual or collective)' }
  }

  // 6. Anti-hallucination: verify key claims against source text
  const hechos = (relato.hechos as string) || ''
  const titulo = (relato.titulo as string) || ''
  const fullOutput = hechos + ' ' + titulo

  // Extract claimed proper names (potential hallucinations)
  const namePattern = /\b[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})+\b/g
  const claimedNames = fullOutput.match(namePattern) || []

  // Common hallucination patterns to flag
  const hallucinationPatterns = [
    'Juan Pérez', 'José Mendoza', 'vereda X', 'municipio de Y',
    'corregimiento de Z', 'finca en la vereda', 'NO ESTATAL con móvil',
  ]

  const hallucinations = claimedNames.filter((name) => {
    // Check if name appears in source text
    const inSource = cleanText.includes(name)
    // Check if it's a known hallucination pattern
    const isKnownPattern = hallucinationPatterns.some((p) => name.includes(p) || fullOutput.includes(p))
    // Flag if plausible name but not in source
    return !inSource && name.length > 5 && !isKnownPattern
  })

  const knownHits = hallucinationPatterns.filter((p) => fullOutput.includes(p))

  if (hallucinations.length > 0) {
    return {
      isCase: false,
      reason: `Hallucination detected: ${hallucinations.slice(0, 3).join(', ')} not found in source`,
    }
  }

  if (knownHits.length > 0) {
    return {
      isCase: false,
      reason: `Template hallucination: ${knownHits.slice(0, 2).join(', ')}`,
    }
  }

  // 7. Valid case!
  const victimCount =
    cantidad?.muertos ||
    victimas?.length ||
    personas?.length ||
    0

  return {
    isCase: true,
    reason: `Valid: ${agresionParticular}, ${victimCount} victims`,
    category: agresionParticular,
    victimCount,
    json,
  }
}
