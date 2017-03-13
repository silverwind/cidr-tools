lint:
	eslint index.js
	pylint *.py

test:
	npm test

publish:
	git push -u --tags origin master
	npm publish

update:
	ncu --packageFile package.json -ua
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
