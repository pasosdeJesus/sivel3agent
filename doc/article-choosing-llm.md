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

Todos corren localmente en Ollama con ROCm 7.2.0 sobre la RX 9060 XT:

| Modelo | Parámetros | Cuantización | VRAM | Tamaño |
|--------|-----------|-------------|------|--------|
| qwen2.5:1.5b-instruct | 1.5B | Q4_K_M | ~1 GB | 986 MB |
| qwen2.5:3b-instruct | 3B | Q4_K_M | ~2 GB | 1.9 GB |
| qwen2.5:7b-instruct | 7B | Q4_K_M | ~5 GB | 4.7 GB |
| qwen2.5:14b-instruct | 14B | Q4_K_M | ~9 GB | 9.0 GB |
| qwen2.5-coder:14b | 14B | Q4_K_M | ~9 GB | 9.0 GB |

**Nota:** Verificamos que `14b-instruct-q4_K_M` y `coder:14b` son el mismo GGUF en Ollama (misma arquitectura `qwen2`, mismos 14.8B parámetros, mismo contexto 32K). La variante Instruct pura de 14B no está disponible en el registry de Ollama — solo la Coder. Esto explica los resultados casi idénticos entre ambos.

---

## 4. Resultados

### 4.1 Puntuación general

| # | Modelo | Score | Agresión | Depto | Municipio | Velocidad |
|---|--------|-------|----------|-------|-----------|-----------|
| 1 | **7B Instruct** | **71.2%** | 5/7 (71%) | 6/7 | 4/7 | 7.1s |
| 2 | 14B Instruct/Coder | 60.8% | 3/7 (43%) | 7/7 | 5/7 | 14.9s |
| 3 | 14B Coder | 60.0% | 3/7 (43%) | 6/7 | 5/7 | 15.3s |
| 4 | 1.5B Instruct | 53.2% | 1/7 (14%) | 6/7 | 5/7 | 3.3s |
| 5 | 3B Instruct | 44.2% | 0/7 (0%) | 6/7 | 5/7 | 4.5s |

**Métrica de clasificación (agresión):** Se normaliza el código CINEP al número (ej: "ASESINATO (40)" → "40", "B40: ASESINATO POLÍTICO" → "40") y se compara con el ground truth. Se considera acierto si el número coincide.

### 4.2 Hallazgos clave

**7B supera a 14B en clasificación.** Contra-intuitivo pero consistente con lo observado en ejecuciones anteriores. El 14B tiende a sobre-analizar y elegir códigos más complejos (ej: "D703: MUERTE DE CIVIL EN ACCIÓN BÉLICA" en vez de "ASESINATO (40)"), resultando en falsos negativos en nuestra métrica de normalización.

**JSON 100% válido en todos los modelos.** El prompt estructurado con lista de códigos CINEP y ejemplo de salida funciona incluso en el modelo de 1.5B.

**Geolocalización excelente.** Incluso el modelo de 1.5B acierta 6/7 departamentos y 5/7 municipios. Los nombres de lugares son fáciles de extraer del texto.

**Identificación de grupos es el punto débil.** Solo 1/7 en el mejor caso. Los modelos no logran extraer "Comandos de la Frontera" u otros nombres de grupos armados del texto fuente. Esto es esperable: el scraping de los artículos a veces no incluye el nombre del grupo en el cuerpo del texto, y los modelos pequeños no infieren.

**3B fue peor que 1.5B.** El modelo de 3B obtuvo 0/7 en clasificación de agresión — posiblemente mal calibrado para tareas de extracción estructurada o con un umbral de creatividad demasiado bajo a temperatura 0.

**Velocidad proporcional al tamaño.** 1.5B es 4.5× más rápido que 14B. Para un pipeline que procesa cientos de artículos, la diferencia es significativa.

---

## 5. Limitaciones del Estudio

1. **Golden dataset pequeño (7 casos).** Resultados preliminares. Se necesita expandir a 30-50 casos para significancia estadística. Cubrimos solo Putumayo — faltan otras regiones (Cauca, Antioquia, Palestina).

2. **14B Instruct real no disponible.** La evaluación de 14B usó el mismo GGUF que Coder. Necesitamos descargar `Qwen2.5-14B-Instruct-GGUF` desde HuggingFace para una comparación justa.

3. **Prompt no usa el SKILL completo.** El prompt actual es una versión simplificada de la metodología Noche y Niebla. El [SKILL de documentación](doc/SKILL-document.md) contiene reglas de clasificación más precisas que podrían mejorar los resultados significativamente.

4. **Scraping de fuentes incompleto.** Algunos artículos scrapeados contienen ruido de navegación (headers, menús) que contamina el texto de entrada.

5. **Métrica de normalización simplista.** Igualar "ASESINATO (40)" con "B40: ASESINATO POLÍTICO" por el número funciona, pero pierde información semántica (DD.HH. vs VPS).

---

## 6. Próximos Pasos

1. **Probar el SKILL como prompt.** Reemplazar el prompt actual por una versión condensada del SKILL de documentación, que incluye las reglas de clasificación por tipo de autor.

2. **Descargar 14B Instruct real.** Obtener el GGUF de `Qwen2.5-14B-Instruct` desde HuggingFace para una comparación justa con 7B.

3. **Expandir golden dataset.** Agregar casos de otras regiones y períodos (Cauca, Antioquia, Palestina 2025-2026).

4. **Probar vLLM con guided JSON.** Migrar de Ollama a vLLM (requiere ROCm 7.13, [REQ/14](REQ/14.md)) para forzar salida JSON válida sin reintentos.

5. **Evaluar Qwen3 y DeepSeek.** Modelos más recientes que podrían superar a Qwen2.5 en extracción estructurada.

6. **Métrica semántica.** Complementar la normalización por número con distancia semántica entre códigos (ej: A10 vs B40 son ambos homicidio pero distinta categoría).

---

## 7. Conclusión Preliminar

**Qwen2.5-7B-Instruct (Q4_K_M) es el mejor modelo para el MVP de sivel3agent.** Con 71% de acierto en clasificación y 7.1 segundos por artículo, ofrece el mejor balance precisión/velocidad/VRAM. El modelo ya está en producción generando pre‑alertas desde fuentes RSS colombianas y palestinas.

La incorporación del SKILL de documentación como prompt del sistema y la migración a vLLM con guided JSON deberían llevar la precisión por encima del 80%, acercándose a la calidad de un documentador humano junior.

---

> *"Con seguridad les digo, donde quiera que esta Buena Nueva se predique por todo el mundo, y lo que ella ha hecho será dicho en conmemoración de ella."* (Marcos 14:9)
