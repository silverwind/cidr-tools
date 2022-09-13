node_modules: package-lock.json
	npm install --no-save
	@touch node_modules

.PHONY: deps
deps: node_modules

.PHONY: test
test: node_modules
	npx eslint --color .
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --color

.PHONY: unittest
unittest: node_modules
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --color --watchAll=true

.PHONY: publish
publish: node_modules
	git push -u --tags origin master
	npm publish

.PHONY: update
update: node_modules
	npx updates -cu
	rm package-lock.json
	npm install
	@touch node_modules

.PHONY: path
patch: node_modules test
	npx versions -C patch
	$(MAKE) --no-print-directory publish

.PHONY: minor
minor: node_modules test
	npx versions -C minor
	$(MAKE) --no-print-directory publish

.PHONY: major
major: node_modules test
	npx versions -C major
	$(MAKE) --no-print-directory publish
