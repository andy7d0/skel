#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

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
	--include='*.json' \
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

make -C /dist -f "$SCRIPT_DIR/jsx-to-php.make" all

echo
echo '<<<<<<<< build DDLs >>>>>>>>>>>>>>>>'
echo


PG_DBS=main_db

. "$SCRIPT_DIR/build-ddls.sh"


echo
echo '<<<<<<<< build classifiers >>>>>>>>>>>>>>>>'
echo

. "$SCRIPT_DIR/build-cls.sh"


echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo

echo '<<<<<<<<<< restart servers >>>>>>>>>>'
for subsystem in ext 
do
	curl -s http://${subsystem}_app:9580/app/${subsystem}/reload
done


