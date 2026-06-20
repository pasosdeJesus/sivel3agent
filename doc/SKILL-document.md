# Skill: Documentación de Casos de Violencia Política

## Propósito

Esta skill permite documentar casos de violencia política siguiendo la metodología del Banco de Datos del CINEP y la Red Nacional de Bancos de Datos de Derechos Humanos y Violencia Política de Colombia.

**La estructura de datos, formatos y vocabularios controlados están definidos en:** [`doc/relato.schema.json`](./relato.schema.json)

Este esquema JSON es la fuente de verdad para:
- Estructura completa del relato (campos, tipos, cardinalidad)
- Campos obligatorios y opcionales
- Formatos de fecha (`YYYY-MM-DD`), hora (`HH:MM AM/PM`), mayúsculas sostenidas
- Tesauros completos (categorías de violencia, departamentos, contextos, organizaciones, etc.)
- Relaciones entre actos, víctimas y responsables

---

## Metodología de documentación

### Paso 1: Recepción de la fuente
Se recibe una fuente (noticia de prensa, pronunciamiento de organización social, denuncia, informe de DDHH, testimonio, etc.).

### Paso 2: Extracción de información
Responder las 9 preguntas fundamentales:
- **¿QUÉ?** El hecho ocurrido (ejecución, amenaza, desplazamiento, bloqueo de vías, bombardeo, detención, tortura, desaparición, confinamiento)
- **¿QUIÉN?** El presunto responsable (grupo armado, fuerza estatal, actor no identificado). Identificar nombre específico si aparece en el texto.
- **¿CONTRA QUIÉN?** La víctima:
  - **Individual:** nombre, ocupación, sector social, pertenencia étnica
  - **Colectiva:** comunidad, resguardo, municipio, población civil afectada. Ej: "POBLACIÓN DE EL CHARCO", "COMUNIDAD NASA DEL RESGUARDO X"
  - **Víctima NN:** si no se conoce la identidad pero sí el hecho, registrar como NN con ocupación conocida
  - La víctima se define por el acto de violencia cometido contra ella, no por un campo de estado
- **¿CÓMO?** Métodos, vehículos, armas, hora, modo
- **¿POR QUÉ?** Móviles que causaron el hecho
- **¿CUÁNDO?** Fecha y hora exactas
- **¿DÓNDE?** Departamento, municipio, vereda, barrio, coordenadas
- **COYUNTURA**: Contexto regional, presencia de actores armados, organizaciones sociales
- **LA OTRA VERSIÓN**: Versiones contradictorias (oficial vs. comunitaria)

### Paso 3: Clasificación del hecho
El acto de violencia (`actos`) es el elemento central — define la categoría y vincula a la víctima. Cada `acto` debe tener:
- `agresion_particular`: código del tesauro (A10, B40, C66, D703, etc.)
- `id_victima_individual` o `id_victima_colectiva`: referencia a la víctima

**Siempre debe existir al menos un `acto` con `agresion_particular` válida.** Sin acto no hay caso.

Clasificación por tipo de autor:
- **Autor estatal/paraestatal** (Ejército, Policía, paramilitares) → DD.HH. (códigos A…)
- **Autor no estatal con móvil político** (guerrilla, disidencias, grupos armados no estatales, desconocidos con móvil político) → Violencia Político-Social (códigos B…)
- **En medio de acción bélica** (combates, bombardeos, bloqueo de vías como táctica militar entre actores armados) → Acción Bélica (códigos C…)
- **Infracción al DIH en conflicto armado** (ataque indiscriminado a población civil, desplazamiento forzado como instrumento de guerra, hambre como método de guerra, confinamiento de poblaciones, bloqueo de vías con afectación a civiles, muerte de civil en acción bélica) → DIHC (códigos D…). Ver marco conceptual para lista completa.
- **Acción Bélica** (combates, bombardeos, bloqueo de vías como táctica militar entre combatientes) → Acción Bélica (códigos C…)

Hechos que SÍ constituyen caso:
- Ejecución, asesinato, desaparición, tortura, secuestro, amenaza (individual o colectiva), desplazamiento forzado, confinamiento, detención arbitraria
- Bloqueo de vías por actor armado: C66 si es táctica militar, D86/D90/D906 si afecta población civil
- Paro armado que confina población civil (D906)
- Ataque indiscriminado (D90), bombardeo que afecta población civil (D703)

Hechos que NO constituyen caso por sí solos:
- Operaciones militares legítimas sin víctimas civiles
- Capturas policiales, procesos judiciales
- Protestas sin violencia documentada
- Análisis académicos o de coyuntura sin hecho concreto
- Destrucción de infraestructura de droga sin víctimas

### Paso 4: Redacción del memo (campo `hechos`)
- Comenzar con **QUIÉN + QUÉ + A QUIÉN** (ej: "Paramilitares ejecutaron a...", "Desconocidos asesinaron a...")
- Usar verbos en **tiempo pasado** (ejecutaron, asesinaron, desaparecieron)
- No usar regionalismos, expresiones calificativas o despectivas
- No usar términos militares coloquiales como "dieron de baja"
- Orden de la información: responsable → acción → víctima → circunstancias de modo, tiempo y lugar → coyuntura → otra versión
- Las horas se expresan en formato 12 horas (ej: "10:00 a.m.", "9:30 p.m.")
- Las citas textuales van entre comillas
- El memo debe ser objetivo y sin apreciaciones personales

### Paso 5: Búsqueda de información adicional
Utilizar buscadores con palabras clave: nombre de la víctima, lugar, fecha, organización responsable. Priorizar fuentes:
1. Informes de DDHH (Human Rights Watch, Indepaz, Comisión Intereclesial de Justicia y Paz)
2. Medios locales del Putumayo (Mi Putumayo Noticias, La Noticia Putumayo, Diario del Sur)
3. Medios nacionales (Caracol Radio, Infobae, Blu Radio, El Heraldo, W Radio, La FM)
4. Fuentes oficiales (Defensoría del Pueblo, Personerías, Fiscalía)
5. Redes sociales (con criterio: contrastar información)

---

## Conversión JSON → XML (para SIVeL 2 legacy)

El sistema legacy SIVeL 2 espera XML según el DTD `relatos-099.dtd`. Para exportar un caso documentado en JSON:

1. Validar el JSON contra `relato.schema.json`
2. Transformar el JSON a XML usando un script (ej. `json2xml.py`)
3. Validar el XML resultante con `xmllint --valid --noout`

**Nota:** El XML generado debe ser compatible con la importación en SIVeL 2. La transformación es directa porque el JSON respeta la misma estructura anidada del DTD.

---

## Validación automática

```bash
# Validar JSON contra el esquema
npx ajv validate -s doc/relato.schema.json -d mi-caso.json

# Si se requiere XML, convertir y validar
python scripts/json2xml.py mi-caso.json > mi-caso.xml
xmllint --valid --noout mi-caso.xml
```

---

## Ejemplo de caso (JSON y XML)

### JSON (válido contra `relato.schema.json`)

```json
{
  "relatos": [
    {
      "organizacion_responsable": "Banco de Datos del CINEP",
      "derechos": "Creative Commons Atribución 2.5 Colombia",
      "id_relato": "172384",
      "forma_compartir": "publico",
      "titulo": "Jhon Fredy Rico, líder social, asesinado en Puerto Guzmán",
      "hechos": "Presuntos integrantes del grupo paramilitar Comandos de la Frontera asesinaron al líder social y defensor de derechos humanos Jhon Fredy Rico...",
      "personas": [
        { "id_persona": "269269", "nombre": "JHON FREDY", "apellido": "RICO", "sexo": "M" }
      ],
      "grupos": [
        { "id_grupo": "14", "nombre_grupo": "PARAMILITARES", "observaciones": [ { "tipo": "otro", "texto": "COMANDOS DE LA FRONTERA" } ] }
      ],
      "fecha": "2025-09-07",
      "hora": "10:00 AM",
      "departamento": "Putumayo",
      "municipio": "Puerto Guzmán",
      "centro_poblado": "JOSÉ MARÍA",
      "actos": [
        {
          "agresion": "VIDA",
          "agresion_particular": "EJECUCIÓN EXTRAJUDICIAL (10)",
          "id_victima_individual": "269269",
          "id_presunto_grupo_responsable": "14"
        }
      ],
      "contextos": [ "PERSECUCIÓN A ORGANIZACIÓN", "PROCESOS DE PAZ O DIÁLOGO" ],
      "observaciones": [
        { "tipo": "intervalo", "texto": "MAÑANA" },
        { "tipo": "region", "texto": "AMAZONÍA" }
      ]
    }
  ]
}
```

### XML equivalente (para importar en SIVeL 2)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE relatos SYSTEM "http://sincodh.pasosdejesus.org/relatos/relatos-099.dtd">
<relatos>
  <relato>
    <organizacion_responsable>Banco de Datos del CINEP</organizacion_responsable>
    <derechos>Creative Commons Atribución 2.5 Colombia</derechos>
    <id_relato>172384</id_relato>
    <forma_compartir>publico</forma_compartir>
    <titulo>Jhon Fredy Rico, líder social, asesinado en Puerto Guzmán</titulo>
    <hechos>Presuntos integrantes del grupo paramilitar Comandos de la Frontera asesinaron al líder social y defensor de derechos humanos Jhon Fredy Rico...</hechos>
    <persona>
      <id_persona>269269</id_persona>
      <nombre>JHON FREDY</nombre>
      <apellido>RICO</apellido>
      <sexo>M</sexo>
    </persona>
    <grupo>
      <id_grupo>14</id_grupo>
      <nombre_grupo>PARAMILITARES</nombre_grupo>
      <observaciones tipo="otro">COMANDOS DE LA FRONTERA</observaciones>
    </grupo>
    <fecha>2025-09-07</fecha>
    <hora>10:00 AM</hora>
    <departamento>Putumayo</departamento>
    <municipio>Puerto Guzmán</municipio>
    <centro_poblado>JOSÉ MARÍA</centro_poblado>
    <acto>
      <agresion>VIDA</agresion>
      <agresion_particular>EJECUCIÓN EXTRAJUDICIAL (10)</agresion_particular>
      <id_victima_individual>269269</id_victima_individual>
      <id_presunto_grupo_responsable>14</id_presunto_grupo_responsable>
    </acto>
    <contexto>PERSECUCIÓN A ORGANIZACIÓN</contexto>
    <contexto>PROCESOS DE PAZ O DIÁLOGO</contexto>
    <observaciones tipo="intervalo">MAÑANA</observaciones>
    <observaciones tipo="region">AMAZONÍA</observaciones>
  </relato>
</relatos>
```

---

## Notas importantes
- La memoria es un acto de fe en la paz: documentar es resistir al olvido
- Todos los casos deben ser tratados con respeto a las víctimas y sus familias
- La objetividad no está reñida con la sensibilidad humana
- La metodología prioriza la verdad sobre la velocidad

## Contacto y referencias
- Banco de Datos del CINEP: https://www.nocheyniebla.org/
- Marco conceptual: https://www.nocheyniebla.org/wp-content/uploads/u1/comun/marcoteorico.pdf
- Esquema JSON: https://raw.githubusercontent.com/pasosdeJesus/sivel3/refs/heads/main/doc/relato.schema.json
- DTD original: http://sincodh.pasosdejesus.org/relatos/relatos-099.dtd
```
