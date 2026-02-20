#!/bin/sh

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
	/src/ $DIST/

	#-n \

{ set +x; } 2>/dev/null

echo
echo '<<<<<<<< rebuild >>>>>>>>>>>>>>>>'
echo

make -C $DIST -f $PWD/jsx-to-php.make all


echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo
