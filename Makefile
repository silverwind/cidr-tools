SOURCE_FILES := index.ts
DIST_FILES := dist/index.js

node_modules: package-lock.json
	npm install --no-save
	@touch node_modules

.PHONY: deps
deps: node_modules

.PHONY: lint
lint: node_modules
	npx eslint --color .
	npx tsgo

.PHONY: lint-fix
lint-fix: node_modules
	npx eslint --color . --fix
	npx tsgo

.PHONY: test
test: node_modules
	npx vitest

.PHONY: test-update
test-update: node_modules
	npx vitest -u

.PHONY: build
build: node_modules $(DIST_FILES)

$(DIST_FILES): $(SOURCE_FILES) package-lock.json vite.config.ts
	npx vite build

.PHONY: update
update: node_modules
	npx updates -cu
	rm -rf node_modules package-lock.json
	npm install
	@touch node_modules

.PHONY: publish
publish: node_modules
	npm publish

.PHONY: path
patch: node_modules lint test
	npx versions patch package.json package-lock.json
	git push -u --tags origin master

.PHONY: minor
minor: node_modules lint test
	npx versions minor package.json package-lock.json
	git push -u --tags origin master

.PHONY: major
major: node_modules lint test
	npx versions major package.json package-lock.json
	git push -u --tags origin master
