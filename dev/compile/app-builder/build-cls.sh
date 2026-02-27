#!/bin/bash

cat_classifier() {
	echo
	printf '"%s/%s":\n' $(dirname "$1"| sed -r 's#/src/#/#') "$(basename "$1"|sed -r 's/^cls[.](.*)[.][a-zA-Z0-9_]+[.](yml|toml|json)/\1/')"
	case "$1" in
		*.yml) 
			yq -o=json --prettyPrint "$1"
		;;
		*.toml)
			toml2json --pretty "$1"
		;;
		*.json)
			cat $1
	esac
	echo ','
}
export -f cat_classifier

for database in $PG_DBS
do
	{
	cat <<- 'MG'
		set client_min_messages = 'notice'; DO $UPDATE_CLS_COMMAND$
		DECLARE
			classifies jsonb;
		BEGIN
		RAISE NOTICE 'MIGRATION CLASSIFIERS starts';
	MG

	echo 'classifies = $JSON_CONST$ {'

	find /src \
		\( -name "cls.*.${database}.json" \
		-o -name "cls.*.${database}.yml" \
		-o -name "cls.*.${database}.toml" \
		\) -print0 \
	| xargs -0 -n 1 -I "#" bash -c 'cat_classifier "#"'

	echo
	echo '"/cls":{"version":"#CLASSIFIERS_VERSION_PLACEHOLDER#"}'

	echo '} $JSON_CONST$::jsonb;'

	echo 'PERFORM cls.update_classifiers(classifies);'

	cat <<- 'MG'
		RAISE NOTICE 'MIGRATION CLASSIFIERS ends';
		END;
		$UPDATE_CLS_COMMAND$;
	MG

	} \
	> /dist-db/${database}/classifiers.sql

	HASH=$(cat /dist-db/${database}/classifiers.sql | sha256sum | cut -d ' ' -f 1)
	sed "s/#CLASSIFIERS_VERSION_PLACEHOLDER#/$HASH/" -i /dist-db/${database}/classifiers.sql
	echo "$HASH" > /dist/common/cls-version;

done
