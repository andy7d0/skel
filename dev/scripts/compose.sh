#!/bin/sh
S_UID="$(id -u)" \
S_GID="$(id -g)" \
S_ZONE="${PWD##*/}" \
docker compose -f docker-compose-top.yml --env-file compose-env "$@"