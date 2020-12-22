node_modules: yarn.lock
	@yarn -s --pure-lockfile
	@touch node_modules

deps: node_modules

test: node_modules
	yarn -s run eslint --color .
	yarn -s run jest --color

unittest: node_modules
	yarn -s run jest --color --watchAll=true

coverage: node_modules
	yarn -s run jest --collectCoverage --coverageReporters text

publish: node_modules
	git push -u --tags origin master
	npm publish

update: node_modules
	yarn -s run updates -cu
	@rm yarn.lock
	@yarn -s
	@touch node_modules

patch: node_modules test
	yarn -s run versions -C patch
	$(MAKE) --no-print-directory publish

minor: node_modules test
	yarn -s run versions -C minor
	$(MAKE) --no-print-directory publish

major: node_modules test
	yarn -s run versions -C major
	$(MAKE) --no-print-directory publish

.PHONY: deps test unittest coverage publish update patch minor major
