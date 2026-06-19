# Contributing to sivel3agent

## 1. Project Structure and Package Managers

This repository is the **AI agent** component of the SIVeL 3 ecosystem. It is an API-only Next.js application.

| Component | Directory | Package Manager | Purpose |
|-----------|-----------|-----------------|---------|
| **Agent API** | `apps/nextjs/` | `pnpm` | Scraper, LLM integration, pre-alert sync |

> **Note:** `apps/hardhat/` is **not used** for now — all smart contracts live in the `pasosdeJesus/sivel3` repository.

---

## 2. Language Conventions

| Context | Language |
|---------|----------|
| Technical documentation (README, ARCHITECTURE, CONTRIBUTING, AGENTS) | **English** |
| Source code, comments, commit messages | **English** |
| Ethical/theological alignment documents (`@pasosdejesus/m/ia/`) | **Spanish** |

---

## 3. Code Style

*   **`apps/nextjs/` (TS):** `pnpm lint`, `pnpm format`
*   Prefer explicit types over inference for function signatures
*   Database queries via Kysely with typed `DB` interface
*   **Database table names:** Use singular nouns (e.g., `source`, not `sources`)

---

## 4. Documentation Policy

Every script, module, and architectural decision must be documented following the same standard as the SIVeL 3 ecosystem:

### Required Documents

| Document | Location | Audience |
|----------|----------|----------|
| **README.md** | Root | Quick start, project overview |
| **ARCHITECTURE.md** | Root | Developers — design decisions, data flow, conventions |
| **AGENTS.md** | Root | AI agents — operational directives, commands, gotchas |
| **CONTRIBUTING.md** | Root | Human contributors — standards, workflow |

### When to Update

-   **New script** → add its purpose and invocation to `ARCHITECTURE.md` §Data Flow
-   **New dependency** → document in `ARCHITECTURE.md` §Tech Stack
-   **New environment variable** → add to `apps/.env` AND `ARCHITECTURE.md` §Environment Configuration
-   **Architecture decision** → document rationale in `ARCHITECTURE.md` §Architecture Decisions
-   **New gotcha or convention** → add to `AGENTS.md` §Conventions & Gotchas

---

## 5. Testing

-   **Framework:** Vitest
-   **Run:** `cd apps/nextjs && make test`
-   **Type check:** `cd apps/nextjs && make type`
-   **DB mocks:** Use `createMockKysely()` from `@pasosdejesus/m/test-utils`, never raw `vi.mock()` for database
-   **Current coverage:** 22 tests (3 suites: `index.test.ts`, `test-utils.example.test.ts`, `generate-and-send.test.ts`)
-   **Test patterns:** Dependency injection (`generateAndSend(dbOverride?)`) for DB‑dependent functions; chainable mock DB using recursive builder; `vi.mock('child_process')` for wallet signing

---

## 6. Wallet Operations

**All wallet interactions must use `bin/m wallet:*`** — never access private keys directly in scripts. Wallets are stored in `~/.m/wallets/` (chmod 600) and referenced by name only.

```bash
# ✅ Correct
./bin/m wallet:list --name sivel3agent --balance --rpc $RPC_URL

# ❌ Wrong
import { Wallet } from 'ethers'
const wallet = new Wallet(process.env.PRIVATE_KEY)
```

---

## 7. Guiding Principles

All contributors are encouraged to act with **Love, Respect, Humility, and Faithful Diligence** (Colossians 3:23), recognizing our work as a service to justice and truth.

*Note: The operational directives in `AGENTS.md` apply strictly to AI Agents; human collaborators should refer to this document and the project principles.*

> *"For there is nothing hidden that will not be disclosed, and nothing concealed that will not be known or brought out into the open."* — Luke 8:17
