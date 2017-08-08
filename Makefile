MSG := $(shell sh -c 'git log -1 --pretty=%B')

default: release

build:
	yarn run build

release: build
	(cd ./build && git add . && git commit -m "$(MSG)" && git push -f)

.PHONY: build release
