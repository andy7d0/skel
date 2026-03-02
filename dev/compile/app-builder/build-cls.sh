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

echo 'DECLARE classifies jsonb = $JSON_CONST$ {'

find /src \
	\( -name "cls.*.${database}.json" \
	-o -name "cls.*.${database}.yml" \
	-o -name "cls.*.${database}.toml" \
	\) -print0 \
| xargs -0 -n 1 -I "#" bash -c 'cat_classifier "#"'

echo

echo ' "": null } $JSON_CONST$::jsonb - $$$$;'

echo 'BEGIN'
echo 'PERFORM cls.update_classifiers(classifies);'
echo 'END;'
