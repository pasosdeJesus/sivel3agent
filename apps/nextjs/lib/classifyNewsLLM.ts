const LLM_URL = process.env.LLM_URL || 'http://localhost:11434/api/generate'
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b-instruct-q4_K_M'

export async function classifyNewsLLM(
  text: string,
  title: string,
): Promise<{ relevant: boolean; reason: string }> {
  const prompt = `
Eres un clasificador de noticias para documentación de violencia política en Colombia y Palestina.

Tarea: Lee TODO el texto y determina si describe un caso de:
- Violación de Derechos Humanos (DDHH)
- Infracción al Derecho Internacional Humanitario (DIH)
- Violencia Político-Social (VPS)

Criterios de inclusión (responde SÍ si aplica CUALQUIERA):
- Asesinatos, desapariciones, tortura, ejecuciones extrajudiciales
- Desplazamiento forzado, masacres, amenazas a líderes sociales
- Ataques a comunidades, restricciones a la libertad de movimiento
- Conflictos armados, presencia de grupos armados ilegales, combates
- Represión política, persecución a defensores de DDHH
- Violencia sexual en contexto de conflicto
- Reclutamiento forzado de menores
- Secuestros por grupos armados
- Operativos militares con víctimas civiles
- Minas antipersona, artefactos explosivos contra civiles
- Violencia de colonos (settlers)
- Bombardeos, ataques aéreos que afectan población civil

Si el artículo describe acciones de grupos armados ilegales (ELN, disidencias FARC,
Clan del Golfo, ACSN, Comandos de la Frontera, etc.) en Colombia, responde SÍ.
Si el artículo describe violencia de colonos o fuerzas israelíes en Palestina, responde SÍ.

Región: Solo Colombia o Palestina. Si menciona otro país sin relación con estos, responde NO.

Noticia:
Título: ${title}
Texto: ${text.slice(0, 8000)}

Responde EXACTAMENTE en este formato:
RELEVANTE: [SÍ/NO]
RAZÓN: [Una frase breve]
`

  const response = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, top_p: 0.9 },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = (await response.json()) as { response: string }
  const relevantMatch = data.response.match(/RELEVANTE:\s*(SÍ|NO)/i)
  const reasonMatch = data.response.match(/RAZÓN:\s*(.+)/i)

  return {
    relevant: relevantMatch?.[1]?.toUpperCase() === 'SÍ',
    reason: reasonMatch?.[1]?.trim() || 'parse error',
  }
}
