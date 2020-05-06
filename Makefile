test:
	yarn -s run eslint --color .
	node --trace-deprecation --throw-deprecation --trace-warnings test.js

publish:
	git push -u --tags origin master
	npm publish

deps:
	rm -rf node_modules
	yarn

update: rollup
	node updates -cu
	$(MAKE) deps

patch: test
	yarn -s run versions -C patch
	$(MAKE) publish

minor: test
	yarn -s run versions -C minor
	$(MAKE) publish

major: test
	yarn -s run versions -C major
	$(MAKE) publish

.PHONY: test publish deps update patch minor major
