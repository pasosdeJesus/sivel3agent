.PHONY: test type dev

test:
	CI=true DOTENV_QUIET=true npx vitest run

type:
	pnpm typecheck

type-check-tests:
	pnpm tsc --noEmit -p tsconfig.test.json

format:
	pnpm format

dev:
	./bin/dev

prod:
	pnpm build
	./bin/start > prod.log 2>&1 &

all:
	pnpm i
	pnpm build
