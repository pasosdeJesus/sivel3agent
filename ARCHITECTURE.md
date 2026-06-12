# sivel3agent — Architecture

## Overview

`sivel3agent` is the AI agent component of the SIVeL 3 ecosystem. It autonomously monitors public news sources (RSS, APIs) to detect socio-political violence events, deduplicates them against the existing sivel3 case database, and generates **pre-alerts** (structured JSON following the Banco de Datos del CINEP methodology) that feed the pre-alert marketplace at sivel.xyz.

The agent runs on its own machine with its own PostgreSQL instance. It is an **API-only Next.js application** — there is no user-facing UI beyond health endpoints.

```
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│   Public Sources    │      │    sivel3agent       │      │      sivel.xyz       │
│   (RSS, APIs)       │─────▶│    (this repo)       │─────▶│    (sivel3 repo)      │
│                     │      │                      │      │                      │
│   ReliefWeb, HRW,   │      │  scrape → deduplicate│      │  POST /api/pre-alerts│
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

---

## Data Flow

```
  1. SCRAPE          2. DEDUPLICATE        3. LLM                 4. SYNC
  ─────────         ──────────────        ────────               ──────────
  scripts/          Compare against       scripts/               scripts/
  scrape-news.ts    sources table +       generate-              send-prealert.ts
  ┌──────────┐      sivel3 case cache     prealert.ts            ┌──────────────┐
  │ RSS feed │─────▶│                   │──────▶│                │ POST /api/   │
  │ API poll │      │ Already exists? ───▶ SKIP  │  Structured   │ pre-alerts/  │
  │ web crawl│      │ New? ─────────────▶ LLM    │  JSON         │ sync ───────▶│
  └──────────┘      └───────────────────┘        │ pre-alert     └──────────────┘
                                                                    │
                                                                    ▼
                                                              sivel.xyz
                                                              (sivel3 repo)
```

### Script Execution Order (via cron)

1. **`scrape-news.ts`** — reads from configured RSS/API sources, stores raw items
2. **`generate-prealert.ts`** — deduplicates against local cache + sivel3 API, runs LLM, produces structured pre-alert JSON
3. **`send-prealert.ts`** — POSTs pre-alert to `sivel.xyz/api/pre-alerts/sync`, optionally records hash on Celo via `bin/m wallet:send`

### Key Tables (to be created in migrations)

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
| Scheduling | cron (system) | Runs scrape → generate → send cycle |
| Package Manager | pnpm (nextjs only) | hardhat not used for now |
