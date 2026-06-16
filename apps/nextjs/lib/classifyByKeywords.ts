const VIOLENCE_KEYWORDS = [
  'asesinato', 'masacre', 'desplazamiento', 'amenaza', 'ejecución',
  'tortura', 'desaparición', 'violencia', 'conflicto', 'guerrilla',
  'paramilitar', 'frente', 'ataque', 'homicidio', 'secuestro',
  'despojo', 'reclutamiento', 'lider social', 'defensor',
  'derechos humanos', 'DDHH', 'DIH', 'violación',
  'masacr', 'asesin', 'muert', 'combate', 'enfrentamiento',
  'asesinad', 'bombardeo', 'minas antipersona', 'artefacto explosivo',
  'asesinan', 'asesinato', 'masacrado', 'desplazad', 'amenazan',
  'paramilitares', 'grupos armados', 'disidencias', 'ELN',
  'extorsión', 'confinamiento', 'despoj', 'reclut',
  'secuestr', 'abatido', 'abatid', 'muert', 'crimen',
  'homicid', 'detonación', 'explosivo', 'armado', 'ilegal',
  'muertos', 'heridos', 'víctima', 'victima', 'falleci',
  'terrorista', 'terrorismo', 'sicari', 'sicario', 'narcotr',
  'kill', 'murder', 'massacre', 'displacement', 'forced', 'settler',
  'occupation', 'detention', 'torture', 'human rights',
  'extrajudicial', 'armed group', 'ceasefire', 'attack',
  'civilian', 'casualt', 'genocide', 'apartheid', 'war crime',
  'killed', 'bombing', 'airstrike', 'drone strike',
]

const COLOMBIA_KEYWORDS = [
  'Putumayo', 'Mocoa', 'Puerto Asís', 'Colombia', 'Cauca', 'Nariño',
  'Villagarzón', 'Orito', 'Sibundoy', 'zona de reserva campesina',
  'Antioquia', 'Chocó', 'Valle del Cauca', 'Norte de Santander',
  'Arauca', 'Catatumbo', 'Bajo Cauca', 'Magdalena Medio',
  'colombian', 'Bogotá', 'Medellín', 'Cali', 'Santander',
  'Putumayo', 'Amazonas', 'Guaviare', 'Meta', 'Córdoba',
  'Huila', 'Tolima', 'Boyacá', 'Cundinamarca', 'Bolívar',
  'Cesar', 'La Guajira', 'Magdalena', 'Sucre', 'Atlántico',
  'Risaralda', 'Quindío', 'Caldas', 'Casanare', 'Vichada',
  'Vaupés', 'Guanía', 'San Andrés', 'colombia',
]

const PALESTINE_KEYWORDS = [
  'Palestine', 'Gaza', 'West Bank', 'Israel', 'occupied Palestinian',
  'Jerusalem', 'Ramallah', 'Hebron', 'Nablus', 'Jenin', 'Rafah',
  'Palestin', 'Gazan', 'Israeli', 'settler violence',
  'oPt', 'occupied territory', 'Palestina', 'Cisjordania',
  'Gaza', 'israelí', 'israelíes', 'sionista', 'israel',
  'Tel Aviv', 'Haifa', 'Beit', 'Khan Younis',
]

export function classifyByKeywords(
  text: string,
  title: string,
): { relevant: boolean; confidence: 'high' | 'low'; reason: string } {
  const textLower = text.toLowerCase()
  const titleLower = title.toLowerCase()

  const hasViolence = VIOLENCE_KEYWORDS.some(
    (k) => textLower.includes(k) || titleLower.includes(k),
  )
  const hasColombia = COLOMBIA_KEYWORDS.some(
    (k) => textLower.includes(k) || titleLower.includes(k),
  )
  const hasPalestine = PALESTINE_KEYWORDS.some(
    (k) => textLower.includes(k) || titleLower.includes(k),
  )

  if (hasViolence && (hasColombia || hasPalestine)) {
    const region = hasColombia ? 'Colombia' : 'Palestine'
    return { relevant: true, confidence: 'high', reason: `violence+${region}` }
  }

  if (hasViolence && !hasColombia && !hasPalestine) {
    return {
      relevant: false,
      confidence: 'low',
      reason: 'violence outside scope',
    }
  }

  if (!hasViolence && (hasColombia || hasPalestine)) {
    return {
      relevant: false,
      confidence: 'low',
      reason: 'region match but no violence keywords',
    }
  }

  return { relevant: false, confidence: 'high', reason: 'no match' }
}
