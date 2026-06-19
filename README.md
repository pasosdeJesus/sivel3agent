# sivel3agent

AI agent for **SIVeL 3** — monitors news sources, extracts pre‑alerts following the **Noche y Niebla** methodology (Banco de Datos del CINEP), and syncs them to the `sivel.xyz` marketplace on Celo.

**Current status (June 2026):** MVP operational. 16 RSS sources, 280 articles in DB, 5 verified pre‑alerts with anti‑hallucination filtering.

## Quick Start

```bash
cd apps/nextjs
pnpm install

# Scrape news from 16 RSS sources
npx tsx scripts/scrape-news.ts

# Detect cases (requires Ollama with qwen2.5:7b or qwen3:8b)
npx tsx scripts/detect-cases.ts

# Generate and send to sivel.xyz
npx tsx scripts/generate-and-send.ts
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `scrape-news.ts` | RSS scraper (16 sources) + classify + full‑text fetch |
| `detect-cases.ts` | Case detector with anti‑hallucination |
| `generate-and-send.ts` | Wallet‑signed sync to sivel.xyz |
| `crawl-2026.ts` | Historical crawler (Crawlee, WIP) |
| `evaluate-models.ts` | Compare LLMs on golden dataset |
| `convert-xrlat.ts` | XML ↔ JSON (Banco de Datos format) |

## Documentation

- **REQ/12.md** — Architecture, crawler evaluation, HANDOFF for next agent
- **REQ/10.md** — Model evaluation results (13 models tested)
- **doc/article-choosing-llm.md** — Article on LLM selection for Noche y Niebla
- **doc/SKILL-document.md** — Noche y Niebla documentation methodology
- **ARCHITECTURE.md** — Data flow, tech stack, environment
- **CONTRIBUTING.md** — Standards, testing, wallet operations