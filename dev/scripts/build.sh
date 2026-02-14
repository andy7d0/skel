#!/bin/sh

set -e

rspack build

docker compose -f docker-compose-top.yml --env-file compose-env run --remove-orphans  --rm -q ext_app ./build.sh

