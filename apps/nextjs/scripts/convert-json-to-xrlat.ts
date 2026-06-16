import fs from 'fs'

interface Observacion {
  tipo: string
  valor?: string | null
}

interface Persona {
  id_persona: string
  nombre?: string
  apellido?: string
  nombre2?: string
  apellido2?: string
  sexo?: string
  fecha_nacimiento?: string
  docid?: string
  observaciones?: Observacion[]
}

interface Grupo {
  id_grupo: string
  nombre_grupo?: string
  sigla?: string
  // biome-ignore lint/suspicious/noExplicitAny: dynamic XML conversion
  [key: string]: any
}

interface Victima {
  id_persona: string
  ocupacion?: string
  sector_condicion?: string
  organizacion?: string
  iglesia?: string
  id_grupo?: string
  estado_tras_hecho?: string
  observaciones?: Observacion[]
}

interface Acto {
  agresion: string
  agresion_particular?: string
  id_victima_individual?: string
  id_grupo_victima?: string
  id_presunto_grupo_responsable?: string
  id_presunto_responsable_individual?: string
}

interface Relato {
  organizacion_responsable: string
  derechos: string
  id_relato: string
  forma_compartir: string
  titulo?: string
  hechos: string
  personas?: Persona[]
  grupos_victimizados?: Grupo[]
  grupos?: Grupo[]
  victimas?: Victima[]
  presuntos_responsables_individuales?: Array<{
    id_persona: string
    id_grupo?: string
    alias?: string
  }>
  fecha?: string
  hora?: string
  duracion?: string
  departamento?: string
  municipio?: string
  centro_poblado?: string
  longitud?: string
  latitud?: string
  actos?: Acto[]
  contextos?: string[]
  fuentes?: Array<{
    nombre_fuente: string
    fecha_fuente?: string
    ubicacion_fuente?: string
  }>
  observaciones_misc?: Record<string, string>
}

interface RelatosRoot {
  relatos: Relato[]
}

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tag(name: string, content: string | undefined | null, indent = ''): string {
  if (content === undefined || content === null) return ''
  return `${indent}<${name}>${esc(content)}</${name}>\n`
}

function tagOpt(name: string, content: string | undefined | null, indent = ''): string {
  if (content === undefined || content === null || content === '') return ''
  return `${indent}<${name}>${esc(content)}</${name}>\n`
}

function obsTag(tipo: string, valor: string | undefined | null, indent = ''): string {
  if (valor === undefined || valor === null || valor === '') return ''
  return `${indent}<observaciones tipo="${esc(tipo)}">${esc(valor)}</observaciones>\n`
}

const KNOWN_OBS_TYPES = new Set([
  'etnia', 'pais', 'filiacion', 'orientacionsexual', 'vinculoestado',
  'anotaciones', 'organizacion_armada', 'rangoedad',
  'subdivision', 'bloque', 'frente', 'otro',
  'personasaprox', 'organizacionarmada',
])

const MISC_OBS_TYPES = [
  'region', 'intervalo', 'tsitio', 'lugar', 'sitio', 'frontera',
  'grconfiabilidad', 'gresclarecimiento', 'grimpunidad', 'grinformacion', 'bienes',
]

function relatoToXML(r: Relato): string {
  let xml = '     <relato>\n'
  xml += tag('organizacion_responsable', r.organizacion_responsable, '       ')
  xml += tag('derechos', r.derechos, '       ')
  xml += tag('id_relato', r.id_relato, '       ')
  xml += tag('forma_compartir', r.forma_compartir, '       ')
  xml += tagOpt('titulo', r.titulo, '       ')
  xml += tag('hechos', r.hechos, '       ')

  // Personas
  if (r.personas) {
    xml += '       <!-- Victimas personas individuales -->\n'
    for (const p of r.personas) {
      xml += '       <persona>\n'
      xml += tag('id_persona', p.id_persona, '         ')
      xml += tagOpt('nombre', p.nombre, '         ')
      xml += tagOpt('nombre2', p.nombre2, '         ')
      xml += tagOpt('apellido', p.apellido, '         ')
      xml += tagOpt('apellido2', p.apellido2, '         ')
      xml += tagOpt('docid', p.docid, '         ')
      xml += tagOpt('fecha_nacimiento', p.fecha_nacimiento, '         ')
      xml += tagOpt('sexo', p.sexo, '         ')
      if (p.observaciones) {
        for (const o of p.observaciones) {
          xml += obsTag(o.tipo, o.valor, '         ')
        }
      }
      xml += '       </persona>\n'
    }
  }

  // Grupos victimizados
  if (r.grupos_victimizados) {
    xml += '       <!-- Grupos victimizados -->\n'
    for (const g of r.grupos_victimizados) {
      xml += grupoToXML(g)
    }
  }

  // Presuntos responsables (grupos)
  if (r.grupos) {
    xml += '       <!-- Presuntos responsables -->\n'
    for (const g of r.grupos) {
      xml += grupoToXML(g)
    }
  }

  // Víctimas
  if (r.victimas) {
    for (const v of r.victimas) {
      xml += '       <!-- Victima Individual -->\n'
      xml += '       <victima>\n'
      xml += tag('id_persona', v.id_persona, '         ')
      xml += tagOpt('ocupacion', v.ocupacion, '         ')
      xml += tagOpt('sector_condicion', v.sector_condicion, '         ')
      xml += tagOpt('iglesia', v.iglesia, '         ')
      xml += tagOpt('organizacion', v.organizacion, '         ')
      xml += tagOpt('id_grupo', v.id_grupo, '         ')
      xml += tagOpt('estado_tras_hecho', v.estado_tras_hecho, '         ')
      if (v.observaciones) {
        for (const o of v.observaciones) {
          xml += obsTag(o.tipo, o.valor, '         ')
        }
      }
      xml += '       </victima>\n'
    }
  }

  // Presuntos responsables individuales
  if (r.presuntos_responsables_individuales) {
    for (const pri of r.presuntos_responsables_individuales) {
      xml += '       <presunto_responsable_individual>\n'
      xml += tag('id_persona', pri.id_persona, '         ')
      if (pri.id_grupo) xml += tag('id_grupo', pri.id_grupo, '         ')
      if (pri.alias) xml += tag('alias', pri.alias, '         ')
      xml += '       </presunto_responsable_individual>\n'
    }
  }

  // Ubicación
  xml += '       <!-- Ubicacion -->\n'
  if (r.fecha !== undefined) xml += tag('fecha', r.fecha, '       ')
  if (r.hora !== undefined) xml += tag('hora', r.hora, '       ')
  if (r.duracion !== undefined) xml += tag('duracion', r.duracion, '       ')
  if (r.departamento !== undefined) xml += tag('departamento', r.departamento, '       ')
  if (r.municipio !== undefined) xml += tag('municipio', r.municipio, '       ')
  if (r.centro_poblado !== undefined) xml += tag('centro_poblado', r.centro_poblado, '       ')
  if (r.longitud !== undefined) xml += tag('longitud', r.longitud, '       ')
  if (r.latitud !== undefined) xml += tag('latitud', r.latitud, '       ')

  // Actos
  if (r.actos && r.actos.length > 0) {
    const hasIndividual = r.actos.some((a) => a.id_victima_individual)
    const hasColectivo = r.actos.some((a) => a.id_grupo_victima)

    if (hasIndividual) xml += '       <!-- Actos con Victimas Individuales -->\n'
    for (const a of r.actos) {
      if (!a.id_victima_individual && !a.id_grupo_victima) continue
      xml += '       <acto>\n'
      xml += tag('agresion', a.agresion, '         ')
      if (a.agresion_particular) xml += tag('agresion_particular', a.agresion_particular, '         ')
      if (a.id_victima_individual) xml += tag('id_victima_individual', a.id_victima_individual, '         ')
      if (a.id_grupo_victima) xml += tag('id_grupo_victima', a.id_grupo_victima, '         ')
      if (a.id_presunto_grupo_responsable) xml += tag('id_presunto_grupo_responsable', a.id_presunto_grupo_responsable, '         ')
      if (a.id_presunto_responsable_individual) xml += tag('id_presunto_responsable_individual', a.id_presunto_responsable_individual, '         ')
      xml += '       </acto>\n'
    }
    if (hasColectivo && !hasIndividual) {
      // already rendered above in the loop
    }
    if (!hasIndividual && !hasColectivo) {
      xml += '       <!-- Actos con Victimas Colectivas -->\n'
    }
  } else {
    xml += '       <!-- Actos con Victimas Individuales -->\n'
    xml += '       <!-- Actos con Victimas Colectivas -->\n'
  }

  // Contextos
  if (r.contextos && r.contextos.length > 0) {
    for (const ctx of r.contextos) {
      xml += obsTag('contexto', ctx, '       ')
    }
  }

  // Fuentes
  if (r.fuentes) {
    for (const f of r.fuentes) {
      xml += '       <fuente>\n'
      xml += tag('nombre_fuente', f.nombre_fuente, '         ')
      if (f.fecha_fuente) xml += tag('fecha_fuente', f.fecha_fuente, '         ')
      if (f.ubicacion_fuente) xml += tag('ubicacion_fuente', f.ubicacion_fuente, '         ')
      xml += '       </fuente>\n'
    }
  }

  // Observaciones misc
  if (r.observaciones_misc) {
    xml += '       <!-- Otros -->\n'
    for (const tipo of MISC_OBS_TYPES) {
      const val = r.observaciones_misc[tipo]
      if (val !== undefined && val !== null) {
        xml += obsTag(tipo, val, '       ')
      }
    }
  }

  xml += '     </relato>\n'
  return xml
}

function grupoToXML(g: Grupo): string {
  let xml = '       <grupo>\n'
  xml += tag('id_grupo', g.id_grupo, '         ')
  if (g.nombre_grupo) xml += tag('nombre_grupo', g.nombre_grupo, '         ')
  if (g.sigla) xml += tag('sigla', g.sigla, '         ')
  // Group-specific observaciones (subdivision, bloque, frente, otro, personasaprox, etc.)
  for (const key of Object.keys(g)) {
    if (['id_grupo', 'nombre_grupo', 'sigla'].includes(key)) continue
    const val = g[key]
    if (typeof val === 'string' && val) {
      xml += obsTag(key, val, '         ')
    }
  }
  xml += '       </grupo>\n'
  return xml
}

// Main
const input = fs.readFileSync(process.argv[2] || '/tmp/casos-put-2025-I.json', 'utf-8')
const data: RelatosRoot = JSON.parse(input)

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
xml += '<!DOCTYPE relatos SYSTEM "http://sincodh.pasosdejesus.org/relatos/relatos-099.dtd">\n'
xml += '<relatos>\n'

for (const r of data.relatos) {
  xml += relatoToXML(r)
}

xml += '</relatos>\n'

const outPath = process.argv[3] || '/tmp/casos-convertidos.xml'
fs.writeFileSync(outPath, xml)
console.log(`Written ${data.relatos.length} relatos to ${outPath}`)
