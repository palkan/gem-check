MSG := $(shell sh -c 'git log -1 --pretty=%B')

default: release

build:
	yarn run build

release: build
	(cd ./build && git add . && git commit -m "$(MSG)" && git push -f)

lint:
	rubocop -r rubocop-md --force-default-config src/pages/
	yarn run spellcheck

.PHONY: build release
