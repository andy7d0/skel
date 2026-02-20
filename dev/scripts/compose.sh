#!/bin/sh
export S_UID="$(id -u)"
export S_GID="$(id -g)"
export S_ZONE="${PWD##*/}"

mkdir -p workarea/sockets/web
mkdir -p workarea/sockets/app
mkdir -p workarea/sockets/main_db

rm -rf workarea/sockets/web/*
rm -rf workarea/sockets/app/*
rm -rf workarea/sockets/main_db/*

mkdir -p workarea/migration/dumps

mkdir -p workarea/cache/ext
mkdir -p workarea/cache/int
mkdir -p workarea/cache/par

mkdir -p workarea/modules/ext
mkdir -p workarea/modules/int
mkdir -p workarea/modules/par

mkdir -p dist/web
mkdir -p dist/app/ext
mkdir -p dist/app/int
mkdir -p dist/app/par
mkdir -p dist/databases/main_db


docker compose -f docker-compose-top.yml --env-file compose-env "$@"