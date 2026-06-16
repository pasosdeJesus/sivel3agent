import fs from 'fs'
import { XMLParser } from 'fast-xml-parser'

const xml = fs.readFileSync(process.argv[2] || '/tmp/casos-put-2025-I.xrlat', 'utf-8')

// Handle &nbsp; and other HTML entities
const cleaned = xml
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  ignoreComment: true,
  isArray: (name) =>
    ['relato', 'persona', 'grupo', 'victima', 'presunto_responsable_individual',
     'acto', 'contexto', 'fuente', 'combatiente', 'observaciones',
     'ubicacion_secundaria', 'agresion_sin_vicd'].includes(name),
})

const data = parser.parse(cleaned)
const relatosXml = data.relatos.relato

function getText(el: unknown): string | null {
  if (el === undefined || el === null) return null
  if (typeof el === 'string') return el.trim() || null
  if (typeof el === 'number') return String(el)
  return null
}

function getObs(obs: unknown[] | undefined, tipo: string): string | null {
  if (!obs || !Array.isArray(obs)) return null
  for (const o of obs) {
    if (typeof o === 'string') continue
    const obj = o as Record<string, unknown>
    if (obj['@tipo'] === tipo) {
      const text = getText(o)
      if (text) return text.trim() || null
    }
  }
  return null
}

function getObsArray(obs: unknown[] | undefined, tipo: string): string[] {
  if (!obs || !Array.isArray(obs)) return []
  return obs
    .filter((o) => typeof o === 'object' && o !== null && (o as Record<string, unknown>)['@tipo'] === tipo)
    .map((o) => getText(o))
    .filter((s): s is string => s !== null)
    .map((s) => s.trim())
}

const relatos = relatosXml.map((r: Record<string, unknown>) => {
  const obsList = (r.observaciones || []) as unknown[]

  const relato: Record<string, unknown> = {
    organizacion_responsable: getText(r.organizacion_responsable),
    derechos: getText(r.derechos),
    id_relato: getText(r.id_relato),
    forma_compartir: getText(r.forma_compartir),
  }

  const titulo = getText(r.titulo)
  if (titulo) relato.titulo = titulo

  relato.hechos = getText(r.hechos)

  // Personas
  const personasRaw = (r.persona || []) as unknown[]
  if (personasRaw.length) {
    relato.personas = personasRaw.map((p) => {
      const obj = p as Record<string, unknown>
      const persona: Record<string, unknown> = {
        id_persona: getText(obj.id_persona),
      }
      const nombre = getText(obj.nombre)
      if (nombre) persona.nombre = nombre
      const apellido = getText(obj.apellido)
      if (apellido) persona.apellido = apellido
      const sexo = getText(obj.sexo)
      if (sexo) persona.sexo = sexo
      const fnac = getText(obj.fecha_nacimiento)
      if (fnac) persona.fecha_nacimiento = fnac
      const obsP = (obj.observaciones || []) as unknown[]
      if (obsP.length) {
        persona.observaciones = obsP.map((o) => {
          const oo = o as Record<string, unknown>
          return { tipo: oo['@tipo'], valor: getText(o) }
        })
      }
      return persona
    })
  }

  // Grupos
  const gruposRaw = (r.grupo || []) as unknown[]
  const gruposVictimizados: unknown[] = []
  const gruposResponsables: unknown[] = []

  // The DTD uses the same <grupo> for both victims and perpetrators.
  // Groups with id_grupo "35" are "Sin Información" (perpetrators with unknown group).
  // Groups with non-35 ids or with nombre_grupo containing descriptive names are victims.
  // We distinguish by looking at id_grupo: 4-25 are known armed groups, 35 is "unknown",
  // and custom ids (>=1000) are victim groups.
  for (const g of gruposRaw) {
    const obj = g as Record<string, unknown>
    const idGrupo = parseInt(getText(obj.id_grupo) || '0')
    const grupoObj: Record<string, unknown> = {}
    if (idGrupo) grupoObj.id_grupo = String(idGrupo)
    const nombre = getText(obj.nombre_grupo)
    if (nombre) grupoObj.nombre_grupo = nombre.trim()
    const sigla = getText(obj.sigla)
    if (sigla) grupoObj.sigla = sigla

    const obsG = (obj.observaciones || []) as unknown[]
    // Extract observaciones with tipo attributes
    for (const o of obsG) {
      if (typeof o === 'string') continue
      const oo = o as Record<string, unknown>
      const tipo = oo['@tipo'] as string | undefined
      const valor = getText(o)
      if (tipo && valor && valor.trim()) {
        grupoObj[tipo] = valor.trim()
      }
    }

    if (idGrupo === 35 || (idGrupo >= 4 && idGrupo <= 25)) {
      // Known armed group codes or unknown = presunto responsable
      gruposResponsables.push(grupoObj)
    } else if (idGrupo >= 1000 || (nombre && nombre !== 'Sin Información' && nombre.length > 20)) {
      // Large custom ids or descriptive names = victim groups
      gruposVictimizados.push(grupoObj)
    }
  }

  if (gruposVictimizados.length) relato.grupos_victimizados = gruposVictimizados
  if (gruposResponsables.length) relato.grupos = gruposResponsables

  // Víctimas individuales
  const victimasRaw = (r.victima || []) as unknown[]
  if (victimasRaw.length) {
    relato.victimas = victimasRaw.map((v) => {
      const obj = v as Record<string, unknown>
      const victima: Record<string, unknown> = {
        id_persona: getText(obj.id_persona),
      }
      const ocupacion = getText(obj.ocupacion)
      if (ocupacion) victima.ocupacion = ocupacion.trim()
      const sector = getText(obj.sector_condicion)
      if (sector) victima.sector_condicion = sector.trim()
      const org = getText(obj.organizacion)
      if (org) victima.organizacion = org.trim()
      const igl = getText(obj.iglesia)
      if (igl) victima.iglesia = igl.trim()
      const estado = getText(obj.estado_tras_hecho)
      if (estado) victima.estado_tras_hecho = estado
      const obsV = (obj.observaciones || []) as unknown[]
      if (obsV.length) {
        victima.observaciones = obsV.map((o) => {
          if (typeof o === 'string') return o
          const oo = o as Record<string, unknown>
          return { tipo: oo['@tipo'], valor: getText(o) }
        })
      }
      return victima
    })
  }

  // Fecha / Ubicación
  const fecha = getText(r.fecha)
  if (fecha) relato.fecha = fecha
  const hora = getText(r.hora)
  if (hora) relato.hora = hora
  const duracion = getText(r.duracion)
  if (duracion) relato.duracion = duracion
  const dep = getText(r.departamento)
  if (dep) relato.departamento = dep
  const mun = getText(r.municipio)
  if (mun) relato.municipio = mun
  const cp = getText(r.centro_poblado)
  if (cp) relato.centro_poblado = cp
  const lon = getText(r.longitud)
  if (lon) relato.longitud = lon
  const lat = getText(r.latitud)
  if (lat) relato.latitud = lat

  // Actos
  const actosRaw = (r.acto || []) as unknown[]
  if (actosRaw.length) {
    relato.actos = actosRaw.map((a) => {
      const obj = a as Record<string, unknown>
      const acto: Record<string, unknown> = {
        agresion: getText(obj.agresion),
      }
      const ap = getText(obj.agresion_particular)
      if (ap) acto.agresion_particular = ap
      const ivi = getText(obj.id_victima_individual)
      if (ivi) acto.id_victima_individual = ivi
      const igv = getText(obj.id_grupo_victima)
      if (igv) acto.id_grupo_victima = igv
      const ipgr = getText(obj.id_presunto_grupo_responsable)
      if (ipgr) acto.id_presunto_grupo_responsable = ipgr
      const ipri = getText(obj.id_presunto_responsable_individual)
      if (ipri) acto.id_presunto_responsable_individual = ipri
      return acto
    })
  }

  // Contextos
  const contextos = getObsArray(obsList, 'contexto')
  if (contextos.length) relato.contextos = contextos

  // Observaciones misc
  const tipoObs = ['region', 'intervalo', 'tsitio', 'lugar', 'sitio', 'frontera',
    'grconfiabilidad', 'gresclarecimiento', 'grimpunidad', 'grinformacion', 'bienes']
  for (const t of tipoObs) {
    const val = getObs(obsList, t)
    if (val) {
      if (!relato.observaciones_misc) relato.observaciones_misc = {}
      ;(relato.observaciones_misc as Record<string, string>)[t] = val
    }
  }

  return relato
})

const result = { relatos }
console.log(JSON.stringify(result, null, 2))
