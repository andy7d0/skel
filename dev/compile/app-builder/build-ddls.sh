#!/bin/bash

cat_file_with_header() {
	echo
	echo "__FILE__ = '$1';"
	echo "__START_LINE__ = 0;"
	cat $1
}
export -f cat_file_with_header

for database in $PG_DBS
do
	{
	cat <<- 'MG'
		set client_min_messages = 'notice'; DO $ALTER_DB_DO_COMMAND$
		DECLARE
			__FILE__ text;
			__START_LINE__ int;
		BEGIN
		RAISE NOTICE 'MIGRATION starts';
	MG

	find /src -name "*.${database}.ddl" -print0 \
	| sort -z \
	| xargs -0 -n 1 -I "#" bash -c 'cat_file_with_header "#"'

	echo 
	echo 
	echo -- epilog
	echo 

	cat <<- 'MG'
		RAISE NOTICE 'MIGRATION ends';
		EXCEPTION WHEN OTHERS THEN
			DECLARE
				v_error text; v_details text; v_hint text; v_stack_trace text;
				trace text[]; trace1 text; traceN text;
				line int;
			BEGIN
				GET STACKED DIAGNOSTICS
				v_error = MESSAGE_TEXT,
				v_details = PG_EXCEPTION_DETAIL,
				v_hint = PG_EXCEPTION_HINT,
				v_stack_trace = PG_EXCEPTION_CONTEXT;

				trace = string_to_array(v_stack_trace,E'\n');
				trace1 = trace[1];
				trace = trace[2:];
				traceN = trace[array_upper(trace, 1)];
				line = SUBSTRING(traceN FROM '(\d+)')::int;

				RAISE NOTICE E'\nERROR: % \n FILE: % LINE: % \n CONTEXT: %'
					, v_error, __FILE__, line - __START_LINE__
					, trace1;
			END;
			-- RAISE;
		END;
		$ALTER_DB_DO_COMMAND$;
	MG

	} \
	| sed '=' | sed -r 'N;s/^(\d+)\n__START_LINE__ = 0;/\1\n__START_LINE__ = \1;/;s/^\d+\n//' \
	| sed -r -f ./extend-ddl.sed \
	> /dist-db/${database}/ddls.sql

	HASH=$(cat /dist-db/${database}/ddls.sql | sha256sum | cut -d ' ' -f 1)
	sed "s/#MIGRATION_VERSION_PLACEHOLDER#/$HASH/" -i /dist-db/${database}/ddls.sql
	echo "$HASH" > /dist/common/ddls-version;

done
