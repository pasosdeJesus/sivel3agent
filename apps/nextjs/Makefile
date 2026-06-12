.PHONY: test type dev health

test:
	CI=true DOTENV_QUIET=true npx vitest run

type:
	pnpm typecheck

type-check-tests:
	pnpm tsc --noEmit -p tsconfig.test.json

format:
	pnpm format

health:
	npx tsx scripts/health.ts

dev:
	./bin/dev

prod:
	pnpm build
	./bin/start > prod.log 2>&1 &

all:
	pnpm i
	pnpm build
