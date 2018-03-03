BIN:=node_modules/.bin

test:
	$(BIN)/eslint index.js
	hash pylint && pylint *.py || true
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

patch: test npm-patch publish
minor: test npm-minor publish
major: test npm-major publish

.PHONY: test publish update npm-patch npm-minor npm-major patch minor major
