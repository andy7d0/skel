#!/bin/bash

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
echo '<<<<<<<< build DDLs >>>>>>>>>>>>>>>>'
echo

cat_file_with_header() {
	echo "-- file: $1"
	cat $1
}
export -f cat_file_with_header

for database in main_db
do
	{
	cat <<- 'MG'
		-- prolog
		set client_min_messages = 'notice';
		DO $ALTER_DB_DO_COMMAND$
		BEGIN
	MG

	find /src -name "*.${database}.ddl" -print0 \
	| sort -z \
	| xargs -0 -n 1 -I "#" bash -c 'cat_file_with_header "#"'

	echo 
	echo 
	echo -- epilog
	echo 

	cat <<- 'MG'
		END;
		$ALTER_DB_DO_COMMAND$;
	MG

	} \
	> /dist-db/${database}/ddls.sql

	HASH=$(cat /dist-db/${database}/ddls.sql | sha256sum | cut -d ' ' -f 1)
	sed -i "s/#MIGRATION_VERSION_PLACEHOLDER#/$HASH/" /dist-db/${database}/ddls.sql

done

echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo

echo '<<<<<<<<<< restart servers >>>>>>>>>>'
for subsystem in ext 
do
	curl -s http://${subsystem}_app:9580/app/${subsystem}/reload
done


