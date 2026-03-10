#!/bin/sh
set -e

if [ "$1" = "images" ]; then

	./dev/scripts/compose.sh pull --ignore-buildable "$@"
	./dev/scripts/compose.sh compose build "$@"
	mkdir -p ./workarea/docker-images
	rm -f ./workarea/docker-images/*
	docker save -o ./workarea/docker-images/all.tar $(./dev/scripts/compose.sh config --images)

	echo images built
	exit;
	
fi

rspack build

./dev/scripts/compose.sh run --remove-orphans  --rm -q app_builder ./build.sh

