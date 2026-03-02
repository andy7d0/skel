#!/bin/bash

cat_prefill() {
	echo
	printf '"%s":\n' \
		"$(basename "$1"|sed -r 's/^([a-zA-Z0-9_]+[.][a-zA-Z0-9_]+)[.][a-zA-Z0-9_]+[.](yml|toml|json)/\1/')"
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
export -f cat_prefill

echo 'DECLARE prefill jsonb = $JSON_CONST$ {'

find /src \
	\( -name "*.${database}.json" \
	-o -name "*.${database}.yml" \
	-o -name "*.${database}.toml" \
	\) \
	\! -name "cls.*" \
	-print0 \
| xargs -0 -n 1 -I "#" bash -c 'cat_prefill "#"'

echo ' "": null } $JSON_CONST$::jsonb - $$$$;'

echo 'BEGIN'

cat <<- 'MG'
	DECLARE n text; d jsonb; scm text; tbl text;
	BEGIN FOR n,d IN SELECT k,v FROM jsonb_each(prefill) _(k,v) LOOP
			scm = (SELECT relnamespace::regnamespace::text as scheme_name
							FROM pg_catalog.pg_class
							WHERE oid = n::regclass);
			tbl = (SELECT relname AS table_name
						FROM   pg_catalog.pg_class
						WHERE  oid = n::regclass);
				
			IF NOT cls.already_processed_version(scm,tbl,d) THEN
				EXECUTE format('SELECT %1I.%2I($1)',scm,tbl||'.prefill') USING d;
			END IF;

		END LOOP;
	END;
MG

echo 'END;'