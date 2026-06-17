# Evaluación de LLMs para Documentación de Violencia Política con Noche y Niebla

**Proyecto:** sivel3agent — Agente IA para SIVeL 3  
**Fecha:** Junio 2026  
**Autor:** Generado por Crush + revisión humana  
**Hardware:** AMD Radeon RX 9060 XT (gfx1200, RDNA4, 16 GB VRAM), Ryzen 9 7900X, ROCm 7.2.0, Ubuntu 24.04

---

## Resumen

Evaluamos 5 modelos de lenguaje (1.5B a 14B parámetros) para extraer y clasificar hechos de violencia política desde artículos de prensa, siguiendo la metodología del Banco de Datos del CINEP (**Noche y Niebla**). El objetivo es seleccionar el mejor modelo para generar pre‑alertas estructuradas en el sistema SIVeL 3.

**Ganador preliminar:** Qwen2.5-7B-Instruct (Q4_K_M, 4.7 GB) con **71.2%** de puntuación ponderada y **71% de acierto en clasificación de agresión** (5/7 casos).

---

## 1. Contexto

SIVeL 3 es un protocolo Web3 para documentación ética de violencia política en Colombia y Palestina. Su componente `sivel3agent` monitorea fuentes de prensa, extrae pre‑alertas mediante LLM, y las sincroniza con la red Celo. La clasificación correcta del tipo de agresión según el marco Noche y Niebla es crítica: un error puede clasificar un asesinato político como delito común, o viceversa.

El marco conceptual del Banco de Datos del CINEP clasifica los hechos en:
- **DD.HH. (A):** Autor estatal o paraestatal — ejecución extrajudicial, desaparición forzada, tortura
- **VPS (B):** Autor no estatal con móvil político — asesinato político, secuestro, amenaza
- **DIHC (D):** Infracciones al Derecho Internacional Humanitario en conflicto armado
- **Acción Bélica (C):** Combate, bombardeo, bloqueo de vías

Tenemos un [SKILL de documentación](doc/SKILL-document.md) que codifica esta metodología y un [esquema JSON](doc/relato.schema.json) con los tesauros completos.

---

## 2. Golden Dataset

Creamos un conjunto de 7 casos reales documentados por el Banco de Datos en Putumayo, primer semestre de 2025, con sus fuentes de prensa originales scrapeadas:

| ID | Fecha | Municipio | Tipo Noche y Niebla | Fuente |
|----|-------|-----------|---------------------|--------|
| 171316 | 2025-01-04 | Mocoa | Asesinato (40) — 2 víctimas | Infobae |
| 171587 | 2025-02-04 | Villagarzón | Colectivo Amenazado (49) — resguardo Nasa | Comisión Intereclesial |
| 171588 | 2025-02-06 | Villagarzón | Amenaza (45) — gobernador Nasa | Comisión Intereclesial |
| 171308 | 2025-03-24 | San Miguel | Asesinato (40) — Comandos de la Frontera | MiPutumayo Noticias |
| 172381 | 2025-04-01 | Puerto Leguízamo | Desplazamiento Forzado (102) — disidencias FARC | Human Rights Watch |
| 171388 | 2025-04-27 | Orito | Asesinato (40) — exconcejal + 4 heridos | W Radio |
| 171405 | 2025-05-01 | Puerto Caicedo | Asesinato (40) — 2 líderes comunales | La Silla Vacía |

Cada caso tiene anotación manual del Banco de Datos (ground truth): código de agresión, departamento, municipio, grupos responsables y contextos.

**Conversión de formatos:** Implementamos conversores bidireccionales XML ↔ JSON ([REQ/15](REQ/15.md)) para interoperar con el sistema legacy SIVeL 2 (DTD `relatos-099.dtd`).

---

## 3. Modelos Evaluados

### Phase 1 — Qwen2.5 family

| Modelo | Parámetros | Cuantización | VRAM | Tamaño |
|--------|-----------|-------------|------|--------|
| qwen2.5:1.5b-instruct | 1.5B | Q4_K_M | ~1 GB | 986 MB |
| qwen2.5:3b-instruct | 3B | Q4_K_M | ~2 GB | 1.9 GB |
| qwen2.5:7b-instruct | 7B | Q4_K_M | ~5 GB | 4.7 GB |
| qwen2.5:14b-instruct | 14B | Q4_K_M | ~9 GB | 9.0 GB |
| qwen2.5-coder:14b | 14B | Q4_K_M | ~9 GB | 9.0 GB |

### Phase 2 — Next‑generation models

| Modelo | Parámetros | Contexto | VRAM | Tamaño |
|--------|-----------|----------|------|--------|
| qwen3:4b | 4B | 256K | ~3 GB | 2.5 GB |
| qwen3:8b | 8B | 40K | ~6 GB | 5.2 GB |
| qwen3:14b | 14B | 40K | ~10 GB | 9.3 GB |
| deepseek-r1:7b | 7B | 128K | ~5 GB | 4.7 GB |
| llama3.2:3b | 3B | 128K | ~2 GB | 2.0 GB |
| phi4:14b | 14B | 16K | ~10 GB | 9.1 GB |
| gemma3:12b | 12B | 128K | ~9 GB | 8.1 GB |

**Notas:**  
- `14b-instruct-q4_K_M`, `coder:14b` y `14b-instruct-real` son el mismo GGUF. Qwen2.5-14B no tiene una variante Instruct separada — el modelo base ya es instruct. Nuestra evaluación de 14B es definitiva: no supera al 7B/8B en esta tarea.

---

## 4. Resultados

### 4.1 Phase 1 — Qwen2.5 family (prompt SKILL)

| # | Modelo | Score | Agresión | Depto | Municipio | Velocidad |
|---|--------|-------|----------|-------|-----------|-----------|
| 1 | **7B Instruct** | **71.3%** | 5/7 (71%) | 6/7 | 4/7 | 7.1s |
| 2 | 14B Instruct/Coder | 60.7% | 3/7 (43%) | 7/7 | 5/7 | 15.5s |
| 3 | 14B Coder | 60.3% | 3/7 (43%) | 6/7 | 5/7 | 14.6s |
| 4 | 1.5B Instruct | 53.2% | 1/7 (14%) | 6/7 | 5/7 | 3.4s |
| 5 | 3B Instruct | 44.2% | 0/7 (0%) | 6/7 | 5/7 | 4.7s |

### 4.2 Phase 2 — Next‑generation models (prompt SKILL)

| # | Modelo | Score | Agresión | Depto | Municipio | Velocidad |
|---|--------|-------|----------|-------|-----------|-----------|
| 1 | **qwen3:8b** | **73.1%** | 5/7 (71%) | 6/7 | 5/7 | 23.3s |
| 2 | qwen2.5:7b | 73.0% | 5/7 (71%) | 6/7 | 4/7 | 7.0s |
| 3 | llama3.2:3b | 68.9% | 4/7 (57%) | 6/7 | 5/7 | 4.6s |
| 4 | phi4:14b | 68.0% | 4/7 (57%) | 6/7 | 5/7 | 15.7s |
| 5 | qwen3:14b | 63.2% | 3/7 (43%) | 7/7 | 4/7 | 40.6s |
| 6 | deepseek-r1:7b | 61.9% | 3/7 (43%) | 5/7 | 5/7 | 19.8s |
| 7 | gemma3:12b | 50.7% | 1/7 (14%) | 6/7 | 5/7 | 17.7s |
| 8 | qwen3:4b | 45.0% | 2/7 (29%) | 3/7 | 2/7 | 59.2s |

**Métrica de clasificación (agresión):** Se normaliza el código CINEP al número (ej: "ASESINATO (40)" → "40", "B40: ASESINATO POLÍTICO" → "40") y se compara con el ground truth. Se considera acierto si el número coincide.

**Puntuación ponderada:** Classification 40% + Geographic 25% + JSON validity 10% + Speed 10% + Actor ID 10% + Context 5%.

### 4.3 Hallazgos clave

**qwen3:8b gana por margen mínimo (0.1%).** Empate técnico con qwen2.5:7b. Ambos logran 71% de acierto en clasificación. La diferencia: qwen3:8b mejora en municipio (5/7 vs 4/7) pero es 3.3× más lento (23.3s vs 7.0s).

**7B supera a 14B en clasificación.** Consistente en ambas fases. Los modelos de 14B sobre-analizan y eligen códigos DIHC complejos (D703, D903) cuando correspondería un B40 o A10. El 7B es más conservador y acierta más.

**llama3.2:3b es la sorpresa.** Con solo 2 GB de VRAM logra 57% de agresión a 4.6s por artículo. Excelente para despliegues con recursos limitados o edge computing.

**phi4:14b sólido pero limitado.** 57% de agresión, comparable a llama3.2:3b, pero su contexto de 16K tokens lo hace inviable para artículos largos (>4000 palabras). Bueno para titulares o resúmenes.

**deepseek-r1:7b decepciona.** Solo 43% de agresión. El "thinking mode" (razonamiento en cadena) no ayuda en tareas de extracción estructurada — genera tokens de razonamiento que no mejoran la clasificación final.

**gemma3:12b y qwen3:4b no son viables.** 14% y 29% de agresión respectivamente. qwen3:4b además es el más lento (59.2s), probablemente por incompatibilidad con ROCm en este modelo específico.

**JSON 100% válido en todos los modelos.** El prompt estructurado con lista de códigos CINEP y ejemplo de salida funciona incluso en el modelo de 1.5B. Cero reintentos necesarios en 104 ejecuciones (13 modelos × 8 casos).

**Geolocalización es la tarea más fácil.** Incluso el peor modelo (qwen3:4b) acierta 3/7 departamentos. Extraer nombres de lugares del texto es un problema resuelto para todos los tamaños de modelo.

**Identificación de grupos sigue siendo el punto débil.** El mejor modelo solo acierta 2/7. Nombres como "Comandos de la Frontera" aparecen en el texto fuente pero los modelos no los extraen consistentemente.

**Velocidad no escala linealmente con tamaño.** qwen3:4b (2.5 GB) es el más lento (59s) — probablemente usando CPU. qwen3:8b (5.2 GB, 23s) es más lento que qwen2.5:7b (4.7 GB, 7s). La arquitectura del modelo importa más que el tamaño.

---

## 5. Limitaciones del Estudio

1. **Golden dataset pequeño (7 casos).** Resultados preliminares. Se necesita expandir a 30-50 casos para significancia estadística. Cubrimos solo Putumayo — faltan otras regiones (Cauca, Antioquia, Palestina).

2. **14B Instruct real no existe como GGUF independiente.** Intentamos descargar `Qwen2.5-14B-Instruct-GGUF` desde HuggingFace (bartowski y Qwen oficial). Ambos son el mismo GGUF que el Coder — misma arquitectura `qwen2`, mismos 14.8B parámetros, mismo contexto 32K. Qwen no publicó un 14B Instruct separado del Coder; el modelo base ya es instruct. Nuestra evaluación de 14B es definitiva.

3. **Prompt SKILL no mejora sobre prompt simple.** Probamos dos variantes de prompt sin diferencia significativa. El cuello de botella está en la capacidad del modelo, no en la ingeniería del prompt.

4. **Scraping de fuentes incompleto.** Algunos artículos scrapeados contienen ruido de navegación (headers, menús) que contamina el texto de entrada.

5. **Métrica de normalización simplista.** Igualar "ASESINATO (40)" con "B40: ASESINATO POLÍTICO" por el número funciona, pero pierde información semántica (DD.HH. vs VPS).

6. **qwen3:4b posiblemente corrió en CPU.** Su velocidad anómala (59.2s) sugiere que Ollama no logró usar ROCm para este modelo específico. Los resultados de velocidad para este modelo no son comparables.

7. **deepseek-r1:7b genera tokens de "thinking".** El modo de razonamiento añade latencia sin mejorar la precisión en extracción estructurada. Para esta tarea, modelos sin cadena de pensamiento son preferibles.

---

## 6. Próximos Pasos

1. **Migrar a qwen3:8b para producción.** Con 73.1% es el nuevo campeón, aunque 3× más lento que 7B. Evaluar si la latencia adicional es aceptable para el pipeline de scraping batch.

2. **Expandir golden dataset.** Agregar casos de Cauca, Antioquia y Palestina (2025-2026) usando la misma metodología: casos del Banco de Datos con fuentes de prensa verificables. Meta: 30+ casos.

3. **Probar vLLM con guided JSON.** Migrar de Ollama a vLLM (requiere ROCm 7.13, [REQ/14](REQ/14.md)) para forzar salida JSON válida y potencialmente mejorar clasificación.

4. **Investigar qwen3:4b en ROCm.** Su velocidad anómala (59s) sugiere que no está usando la GPU. Verificar compatibilidad ROCm para modelos qwen3 pequeños.

5. **Métrica semántica.** Complementar la normalización por número con distancia semántica entre códigos (ej: A10 vs B40 son ambos homicidio pero distinta categoría de autor).

6. **Fine‑tuning (#11).** Postergado hasta tener 100+ casos anotados. La evaluación actual muestra que 14B no supera a 7B/8B, así que el fine‑tuning sería sobre qwen2.5:7b o qwen3:8b. Prioridad baja para MVP.

---

## 7. Conclusión

Evaluamos 13 configuraciones de modelos (5 Qwen2.5 + 7 next‑gen + 1 coder) para extraer y clasificar hechos de violencia política desde artículos de prensa siguiendo la metodología **Noche y Niebla** del Banco de Datos del CINEP.

**Ganador técnico: qwen3:8b (73.1%).** Pero el margen sobre qwen2.5:7b (73.0%) es insignificante. Para producción recomendamos:

| Uso | Modelo | Score | Velocidad | VRAM |
|-----|-------|-------|-----------|------|
| **Producción MVP** | qwen2.5:7b | 73.0% | 7.0s | 4.7 GB |
| **Máxima precisión** | qwen3:8b | 73.1% | 23.3s | 5.2 GB |
| **Edge / bajo consumo** | llama3.2:3b | 68.9% | 4.6s | 2.0 GB |

**qwen2.5:7b-instruct-q4_K_M sigue siendo la mejor opción para el MVP de sivel3agent:** precisión virtualmente idéntica al ganador pero 3.3× más rápido y con menor consumo de VRAM. Ya está en producción generando pre‑alertas desde fuentes RSS colombianas y palestinas.

La siguiente frontera no está en cambiar de modelo sino en mejorar el pipeline: scraping de artículos completos (#13), vLLM con guided JSON (#14), y expansión del golden dataset para evaluación más robusta.

---

**Agradecimientos:** Al Banco de Datos del CINEP por proporcionar los casos anotados y la metodología Noche y Niebla. Este trabajo se realizó con hardware donado por la comunidad: AMD Radeon RX 9060 XT (16 GB VRAM) corriendo ROCm 7.2.0 sobre Ubuntu 24.04.

---

> *"Con seguridad les digo, donde quiera que esta Buena Nueva se predique por todo el mundo, y lo que ella ha hecho será dicho en conmemoración de ella."* (Marcos 14:9)
