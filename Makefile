node_modules: package-lock.json
	npm install --no-save
	@touch node_modules

deps: node_modules

test: node_modules
	if [[ $$(node -v) != v10* ]]; then npx eslint --color .; fi
	npx jest --color

unittest: node_modules
	npx jest --color --watchAll=true

coverage: node_modules
	npx jest --collectCoverage --coverageReporters text

publish: node_modules
	git push -u --tags origin master
	npm publish

update: node_modules
	npx updates -cu
	rm package-lock.json
	npm install
	@touch node_modules

patch: node_modules test
	npx versions -C patch
	$(MAKE) --no-print-directory publish

minor: node_modules test
	npx versions -C minor
	$(MAKE) --no-print-directory publish

major: node_modules test
	npx versions -C major
	$(MAKE) --no-print-directory publish

.PHONY: deps test unittest coverage publish update patch minor major
