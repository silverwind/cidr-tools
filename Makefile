SOURCE_FILES := index.ts
DIST_FILES := dist/index.js

node_modules: pnpm-lock.yaml
	pnpm install
	@touch node_modules

.PHONY: deps
deps: node_modules

.PHONY: lint
lint: node_modules
	pnpm exec eslint-silverwind --color .
	pnpm exec tsgo

.PHONY: lint-fix
lint-fix: node_modules
	pnpm exec eslint-silverwind --color . --fix
	pnpm exec tsgo

.PHONY: test
test: node_modules
	pnpm exec vitest
	bun test --only-failures --concurrent

.PHONY: test-update
test-update: node_modules
	pnpm exec vitest -u

.PHONY: test-coverage
test-coverage: node_modules
	pnpm exec vitest --coverage

.PHONY: build
build: node_modules $(DIST_FILES)

$(DIST_FILES): $(SOURCE_FILES) pnpm-lock.yaml package.json tsdown.config.ts tsconfig.json
	pnpm exec tsdown

.PHONY: bench
bench: node_modules
	@node bench.ts

.PHONY: publish
publish: node_modules
	pnpm publish --no-git-checks

.PHONY: update
update: update-js update-actions

.PHONY: update-js
update-js: node_modules
	pnpm exec updates -u -f package.json
	rm -rf node_modules pnpm-lock.yaml
	pnpm install
	@touch node_modules

.PHONY: update-actions
update-actions: node_modules
	pnpm exec updates -u -M actions

.PHONY: patch minor major
patch minor major: node_modules lint test
	pnpm exec versions -R $@ package.json
