BIN:=node_modules/.bin

lint:
	$(BIN)/eslint index.js
	pylint *.py

test:
	$(MAKE) lint
	$(BIN)/ava

publish:
	git push -u --tags origin master
	npm publish

update:
	$(BIN)/updates -u
	rm -rf node_modules
	yarn

npm-patch:
	npm version patch

npm-minor:
	npm version minor

npm-major:
	npm version major

patch: lint test npm-patch publish
minor: lint test npm-minor publish
major: lint test npm-major publish

.PHONY: lint test publish update npm-patch npm-minor npm-major patch minor major
