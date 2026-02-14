#!/bin/sh

[ "$PWD" = "/app" ] || exit 1

set -e

echo 
echo '<<<<<<<< sync dist >>>>>>>>>>>>>>>>'
echo

set -x
rsync \
	-r \
	-u \
	-l \
	--safe-links \
	-t \
	-x \
	-m \
	--update \
	--delete \
	--exclude='/servers/' \
	--exclude='.*' \
	--include='*/' \
	--include='*.txt' \
	--include='*.php' \
	--include='*.yml' \
	--include='*.toml' \
	--include='*.jsx' \
	--exclude='*' \
	-v \
	/app/ /dist/

	#-n \

{ set +x; } 2>/dev/null

echo
echo '<<<<<<<< rebuild >>>>>>>>>>>>>>>>'
echo

make -C /dist -f /app/jsx-to-php.make all


echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo
