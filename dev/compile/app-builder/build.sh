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
	/src/ /dist/

	#-n \

{ set +x; } 2>/dev/null

echo
echo '<<<<<<<< rebuild >>>>>>>>>>>>>>>>'
echo

make -C /dist -f /build/jsx-to-php.make all


echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo

echo '<<<<<<<<<< restart servers >>>>>>>>>>'
curl -s http://ext_app:9580/app/ext/reload

