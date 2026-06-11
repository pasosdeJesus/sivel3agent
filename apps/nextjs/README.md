# sivel3agent

SIVeL 3 Agetn ERC-8004 -a

## Quick Start

### Prerequisites

- Node.js
- pnpm
- PostgreSQL (running service)

### Installation

1.  Install the project dependencies:

    ```bash
    pnpm install
    ```

2.  Review the newly created `.env` file. It contains the initial configuration for your development environment:

    ```env
    # Development database credentials
    PGUSER=sivel3agent
    PGPASSWORD=changeme
    PGDATABASE=sivel3agent_dev

    # PostgreSQL superuser credentials (for local administrative tasks)
    PG_SUPERUSER=postgres
    PG_SUPERUSER_PASSWORD=
    ```

    **Important!** This database configuration is a starting point. You **must** verify that these values match your local system's setup. For example, the `PG_SUPERUSER` might be different (e.g., `postgres`, `user`, etc.) depending on your PostgreSQL installation. Adjust these variables as needed before proceeding.

## Available Commands

- `pnpm test`: Runs the test suite with `vitest`.
- `pnpm typecheck`: Type-checks the TypeScript code without emitting files.

## CLI Usage

This project is managed through a Command Line Interface (CLI) named `m`, inspired by the modularity and power of Ruby on Rails.

### `db:super:createuser`

Creates a new role and database using the variables from `.env`.

- **Authentication:** Connects using `PG_SUPERUSER` and `PG_SUPERUSER_PASSWORD`.
- **Creation:** Creates the user (`PGUSER`), password (`PGPASSWORD`), and database (`PGDATABASE`).

**Usage:**

```bash
./bin/m db:super:createuser
```

## Environment & Configuration

This project uses a cumulative and hierarchical `.env` loading logic via the **m** CLI. The CLI searches for configuration files from the workspace root down to this directory, following this order (last one wins):

1. `../../.env` and `../../.env.test` (Workspace root)
2. `../.env` and `../.env.test` (Apps/ parent directory)
3. `.env` and `.env.test` (This directory)

**Best Practice:** Define shared settings (like `PGHOST` for Unix sockets or `PG_SUPERUSER` credentials) in the common `apps/.env` file. Use the local `.env` only for application-specific overrides.

### Project Structure


- `bin/m`: The CLI executable.
- `src/index.ts`: The main application entry point.
- `tests/`: Contains test files.
- `.env`: Environment configuration file.
- `package.json`: Project dependencies and scripts.
- `tsconfig.json`: TypeScript configuration.
