# sivel3agent

SIVeL 3 Agetn ERC-8004 -a

This project was generated using **m**, a CLI for Next.js + Hardhat projects with a Rails-like backend.

## Quick Start

### 1. Install dependencies

```bash
cd apps/nextjs
pnpm install
```

If you encounter issues with pnpm, try using `npm install` instead (though pnpm is recommended).

### 2. Configure your environment

Edit the `.env` file in the `apps/` directory to match your local PostgreSQL configuration:

```bash
cd ..
nano .env
```

Key variables to set:
- `PG_SUPERUSER`: Your PostgreSQL superuser (e.g., `postgres`)
- `PG_SUPERUSER_PASSWORD`: Password for the superuser (if required)
- `PGHOST`: PostgreSQL host (e.g., `/var/www/var/run/postgresql` for adJ/OpenBSD)

### 3. Create the database user

```bash
cd apps/nextjs
./bin/m db:super:createuser
```

### 4. Start development

```bash
# From the project root
make dev

# Or run individual services
cd apps/nextjs && pnpm dev
cd apps/hardhat && pnpm node
```

## Project Structure

- `apps/nextjs/` - Next.js frontend with Rails-like backend structure
- `apps/hardhat/` - Hardhat smart contract development environment
- `apps/.env` - Unified environment configuration for both apps
- `db/` - Database migrations and structure files

## Available Commands

### From the project root:
- `make dev` - Start both Next.js and Hardhat in development mode
- `make test` - Run tests in both applications
- `make type` - Run TypeScript type checking

### From `apps/nextjs/`:
- `./bin/m --help` - Show all available CLI commands
- `./bin/m db:create` - Create the development database
- `./bin/m db:migrate` - Run database migrations
- `./bin/m contract:compile` - Compile smart contracts

## Database Management

The project uses Kysely for type-safe database operations with PostgreSQL. Key commands:

```bash
# Create a new migration
./bin/m db:mig:make add_users_table

# Run migrations
./bin/m db:migrate

# Rollback the last migration
./bin/m db:rollback

# Open database console
./bin/m db:console
```

## Testing

Run the test suite:

```bash
# From apps/nextjs/
pnpm test

# Or from project root
make test
```

## Troubleshooting

### pnpm installation issues
If pnpm fails with "double free" or abort errors on OpenBSD, try:

1. Clear pnpm cache: `pnpm store prune`
2. Use npm instead: `npm install` (update package.json to use npm)
3. Install pnpm from ports: `doas pkg_add pnpm`

### Database connection issues
Ensure PostgreSQL is running and accessible:

```bash
# Check PostgreSQL status (adJ/OpenBSD)
pg_ctl -D /var/postgresql/data status

# Test connection
cd apps/nextjs
./bin/m db:test
```

## Next Steps

1. Review and customize `apps/.env` with your specific configuration
2. Create your first database migration with `./bin/m db:mig:make`
3. Modify the smart contracts in `apps/hardhat/contracts/`
4. Customize the Next.js frontend in `apps/nextjs/app/`

## Support

For issues with the generated project structure, refer to the [m CLI documentation](https://gitlab.com/pasosdejesus/m).

---

*Generated with [m CLI](https://gitlab.com/pasosdejesus/m) • Version 0.3.1*