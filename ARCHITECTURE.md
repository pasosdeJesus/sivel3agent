# sivel3agent — Architecture

## Overview

`sivel3agent` is the AI agent component of the SIVeL 3 ecosystem. It autonomously monitors public news sources (RSS, APIs) to detect socio-political violence events, deduplicates them against the existing sivel3 case database, and generates **pre-alerts** (structured JSON following the Banco de Datos del CINEP methodology) that feed the pre-alert marketplace at sivel.xyz.

The agent runs on its own machine with its own PostgreSQL instance. It is an **API-only Next.js application** — there is no user-facing UI beyond health endpoints.

**Two ingestion paths:**
1. **RSS scraper** (`scrape-news.ts`) — for active sources with working RSS feeds. Weekly cron.
2. **Historical crawler** (`crawl.ts`) — for sources without usable RSS (abandoned feeds, at‑risk archives). Crawlee + CheerioCrawler. One‑time or infrequent. Sources in `config/sources.json` with `risk` indicator.

```
┌─────────────────────┐      ┌───────────────────────┐      ┌─────────────────────┐
│   Public Sources    │      │    sivel3agent         │      │      sivel.xyz       │
│   (RSS, Crawlee)    │─────▶│    (this repo)         │─────▶│    (sivel3 repo)      │
│                     │      │                        │      │                      │
│   ReliefWeb, HRW,   │      │  scrape → deduplicate  │      │  POST /api/pre-alerts│
│   Amnesty, news...  │      │  → LLM → pre-alert   │      │  /sync               │
└─────────────────────┘      └──────────┬───────────┘      └──────────┬───────────┘
                                        │                             │
                                        │  bin/m wallet:*             │
                                        ▼                             ▼
                               ┌─────────────────┐          ┌─────────────────┐
                               │   Celo Network  │          │  PreAlertMarket │
                               │   (Sepolia/L2)  │          │  (smart contract)│
                               └─────────────────┘          └─────────────────┘
```

---

## Repository Structure

```
sivel3agent/
├── apps/
│   ├── nextjs/               # API-only Next.js application (pnpm)
│   │   ├── config/           # Source configuration (JSON)
│   │   │   └── sources.json  # Source of truth: active (RSS) + legacy (crawler) sources
│   │   ├── scripts/          # Agent scripts (scraper, LLM, sync, health)
│   │   ├── lib/              # Shared utilities (DB helpers, API clients, LLM wrapper)
│   │   ├── db/migrations/    # Kysely migrations (agent-specific tables)
│   │   ├── app/              # Health endpoint only (no UI pages)
│   │   ├── abis/             # Contract ABIs (unused — contracts live in sivel3)
│   │   ├── tests/            # Vitest test suite
│   │   ├── .config/          # Kysely DB config → PostgreSQL
│   │   ├── bin/m             # m CLI (framework from @pasosdejesus/m)
│   │   ├── Makefile
│   │   └── pnpm-workspace.yaml
│   └── hardhat/              # NOT USED for now (contracts live in sivel3 repo)
├── apps/.env                 # Single source of truth for all configuration
├── Makefile                  # Root orchestrator
├── AGENTS.md                 # AI agent operational directives
├── ARCHITECTURE.md           # This file
└── CONTRIBUTING.md           # Contribution guidelines
```

---

## Architecture Decisions

### 1. API-Only Next.js

`sivel3agent` has no user-facing UI. It is a **Next.js API-only** application:
- `app/` contains at most a health check route (`GET /api/health`)
- All agent logic lives in `scripts/` and is executed via cron
- Next.js is used only for its module resolution, TypeScript support, and `@pasosdejesus/m` integration

### 2. Wallet Security: All Operations via `bin/m wallet:*`

**No direct private key access in scripts.** All wallet operations (balance checks, transfers, signing, broadcasting) go through the `bin/m wallet:*` CLI from `@pasosdejesus/m`. This ensures:

- Private keys stay in `~/.m/wallets/` (chmod 600), never in `.env` or source code
- Single audit point for cryptographic operations
- Fixes and improvements to wallet handling benefit all pdJ projects
- Scripts reference wallets by **name** only (`AGENT_WALLET_NAME`), never by address or key

```bash
# ✅ Correct — use bin/m
./bin/m wallet:balance --name sivel3agent --rpc $RPC_URL

# ❌ Wrong — never do this
const key = process.env.PRIVATE_KEY
const wallet = new ethers.Wallet(key)
```

### 3. Separate PostgreSQL Instance

The agent runs on its own machine with its **own local PostgreSQL instance**:
- Database: `sivel3agent_dev`
- Tables: agent-specific (sources, case cache, pre-alert queue)
- No shared database with sivel3 — communication happens via REST API (`POST /api/pre-alerts/sync`)

### 4. Contracts Live in sivel3

The `apps/hardhat/` directory is **not used** in sivel3agent. All smart contracts (`PreAlertMarket.sol`, `CaseCertification.sol`) live in the `pasosdeJesus/sivel3` repository. Only their ABIs may be copied here if needed for local type generation.

### 5. Source Configuration (`config/sources.json`)

Single source of truth for all news sources. Used by both `scrape-news.ts` and `crawl.ts`.

```json
{
  "active": [
    { "name": "INDEPAZ", "url": "https://indepaz.org.co/feed/", "region": "Colombia" }
  ],
  "legacy": [
    {
      "name": "Contagio Radio",
      "type": "wordpress",
      "baseUrl": "https://www.contagioradio.com",
      "region": "Colombia",
      "risk": "high",
      "selectors": {
        "list": "h2 a, h3 a, .entry-title a",
        "title": "h1, .entry-title",
        "date": "time, .entry-date",
        "body": "div.entry-content"
      }
    }
  ]
}
```

**`active[]`** — RSS feeds scraped by `scrape-news.ts`:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✓ | Medium name (stored in `source.medium`) |
| `url` | ✓ | RSS feed URL |
| `region` | ✓ | Geographic region (Colombia, Putumayo, Palestine) |

**`legacy[]`** — Sources without usable RSS, crawled by `crawl.ts`:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✓ | Medium name (stored in `source.medium`) |
| `type` | ✓ | CMS type: `wordpress` (supports `/YYYY/MM/` archives). Future: `spip`, `static` |
| `baseUrl` | ✓ | Site root URL (no trailing slash) |
| `region` | ✓ | Geographic region |
| `risk` | | `high` = site may go offline soon (archive ASAP). `low` = stable. Default: `low` |
| `selectors.list` | ✓ | CSS selectors for article links on archive pages |
| `selectors.title` | ✓ | CSS selectors for article title (tried left-to-right) |
| `selectors.date` | ✓ | CSS selectors for publication date |
| `selectors.body` | ✓ | CSS selectors for article body text |

---

## Data Flow

```
  1. SCRAPE+CLASSIFY   2. DETECT CASES       3. SYNC
  ─────────────────   ──────────────────     ──────────
  scrape-news.ts      detect-cases.ts        generate-and-send.ts
  ┌──────────────┐    ┌──────────────┐       ┌────────────────┐
  │ 16 RSS feeds│───▶│ source table │──────▶│ pre_alert table│
  │ fetchFullText│    │ case-detector│       │ → wallet sign  │
  │ classify     │    │ anti-halluc. │       │ → sivel.xyz    │
  └──────────────┘    └──────────────┘       └────────────────┘
```

### Script Execution Order (via cron)

The pipeline is orchestrated by `scripts/run-agent.sh`, which runs three steps in sequence:

```
run-agent.sh → scrape-news.ts → detect-cases.ts → generate-and-send.ts
```

**Crontab setup:** one line, sources `.env` automatically from the script:

```
0 */6 * * * /opt/sivel3agent/apps/nextjs/scripts/run-agent.sh
```

The script reads `../../../.env` relative to its location, sources all environment variables, and runs the full pipeline (scrape → detect → send) with locking to prevent concurrent runs. Logs to `$SIVEL3AGENT_LOG_DIR/agent.log`.

1. **`scrape-news.ts`** — 15 RSS feeds → fetchFullText → classify → store in `source`

   **Usage:** `node_modules/.bin/tsx scripts/scrape-news.ts [SOURCE_NAME|URL_FRAGMENT]`

   **Environment variables:**
   - `SCRAPE_FEED` — filter by medium name or URL substring
   - `SCRAPE_START_DATE` — override start date (default `2025-07-01`)
   - `SCRAPE_END_DATE` — override end date (default now)
   - Idempotent: deduplicates by `url` unique constraint and `content_hash`

2. **`crawl.ts`** — Crawlee historical crawler for sources without RSS → monthly archives → store in `source`

   **Usage:** `node_modules/.bin/tsx scripts/crawl.ts [--year YYYY] [--legacy] [--source NAME] [--list]`

   **Flags:**
   - `--year 2026` — crawl a specific year's monthly archives
   - `--legacy` — full historical range (from first known article to now)
   - `--source NAME` — filter by medium name or URL fragment
   - `--list` — show configured legacy sources

   **Environment variables:**
   - `CRAWL_CUTOFF` — override minimum date (default: `2015-01-01` for `--legacy`, `{year}-01-01` for `--year`)
   - `CRAWL_MAX_REQUESTS` — override `maxRequestsPerCrawl` (default 1000)
   - `CRAWL_CONCURRENCY` — override `maxConcurrency` (default 2)
   - Sources in `config/sources.json` (legacy section), with `risk` indicator
   - Idempotent: skips URLs already in DB

3. **`detect-cases.ts`** — batch process `source` → `detectCase()` (anti‑hallucination) → store in `pre_alert`
4. **`generate-and-send.ts`** — sign with agent wallet → POST to `sivel.xyz/api/pre-alerts/sync`
5. **`crawl-2026.ts`** — historical WordPress crawler (no RSS) → monthly archives → store in `source`

### Key Tables (active)

| Table | Rows | Purpose |
|-------|------|---------|
| `source` | 280 | Raw articles with `clean_text`, `is_relevant`, `classification_reason` |
| `pre_alert` | 5 | Verified cases with Noche y Niebla category |
| `pre_alert_source` | 5 | Links pre_alert ↔ source |

| Table | Purpose |
|-------|---------|
| `sources` | RSS feeds, API endpoints to monitor |
| `raw_items` | Raw scraped articles/events |
| `case_cache` | Local copy of sivel3 case hashes for dedup |
| `prealerts` | Generated pre-alerts pending sync |

---

## Environment Configuration

Single source of truth: `apps/.env`

| Variable | Purpose |
|----------|---------|
| `AGENT_WALLET_NAME` | Wallet name for `bin/m wallet:*` (e.g., `sivel3agent`) |
| `AGENT_WALLET_ADDRESS` | Expected address (validated by health check) |
| `PGHOST` | PostgreSQL host (`localhost` on Ubuntu, socket path on adJ) |
| `PGDATABASE` | `sivel3agent_dev` |
| `PGUSER` / `PGPASSWORD` | Database credentials |
| `NEXT_PUBLIC_RPC_URL` | Celo RPC endpoint (Forno public or private) |
| `NEXT_PUBLIC_NETWORK` | `celoSepolia` (testnet) or `celo` (mainnet) |
| `SIVEL3_API_URL` | Base URL of sivel.xyz for sync (future) |
| `LLM_API_KEY` | API key for LLM service (future) |
| `SCRAPE_FEED` | Filter `scrape-news.ts` to a single RSS source by name or URL |
| `SCRAPE_START_DATE` | Override scrape start date (default `2025-07-01`, format `YYYY-MM-DD`) |
| `SCRAPE_END_DATE` | Override scrape end date (default now, format `YYYY-MM-DD`) |
| `CRAWL_CUTOFF` | Minimum date for `crawl.ts` (default `2015-01-01` for `--legacy`) |
| `CRAWL_MAX_REQUESTS` | Override `maxRequestsPerCrawl` (default 1000) |
| `CRAWL_CONCURRENCY` | Override `maxConcurrency` (default 2) |

---

## Commands

```bash
# Development
cd apps/nextjs && pnpm dev          # Start API server
cd apps/nextjs && pnpm tsx scripts/health.ts  # Health check (DB + wallet)

# Testing
cd apps/nextjs && make test         # Vitest
cd apps/nextjs && make type         # TypeScript check

# Database
cd apps/nextjs && ./bin/m db:create
cd apps/nextjs && ./bin/m db:migrate
cd apps/nextjs && ./bin/m db:mig:make add_sources_table

# Wallet
cd apps/nextjs && ./bin/m wallet:list --name sivel3agent --balance --rpc $RPC
```

---

## Tech Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Runtime | Next.js 15 (API-only) | Module resolution, TypeScript, `@pasosdejesus/m` |
| Database | PostgreSQL + Kysely | Local instance, type-safe queries |
| Blockchain | Celo (L2) | Mainnet (42220), Sepolia testnet (11142220) |
| Wallet | `bin/m wallet:*` | Private keys in `~/.m/wallets/`, chmod 600 |
| Testing | Vitest | `fileParallelism: false`, `maxWorkers: 1` |
| LLM | TBD (DeepSeek API or local) | Used in `generate-prealert.ts` |
| Scraping | `rss-parser` + `xml2js` (fallback) | xml2js parses broken XML that rss-parser rejects |
| Scheduling | cron (system) | Runs scrape → generate → send cycle |
| Package Manager | pnpm (nextjs only) | hardhat not used for now |
