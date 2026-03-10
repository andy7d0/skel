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
	--include='*.cs.mjs' \
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
echo '<<<<<<<< build DBs >>>>>>>>>>>>>>>>'
echo


PG_DBS=main_db

for database in $PG_DBS
do
	echo
	echo "<<<<<<<<<<< $database >>>>>>>>>>>>>>>>"

	{
	cat <<- 'MG'
		set client_min_messages = 'notice'; 
		DO $ALTER_DB_DO_COMMAND$
		DECLARE
			__FILE__ text;
			__START_LINE__ int;
		BEGIN

		RAISE NOTICE 'MIGRATION starts';

		SET statement_timeout = 0;
		SET lock_timeout = 0;
		SET idle_in_transaction_session_timeout = 0;
		SET client_encoding = 'UTF8';
		SET standard_conforming_strings = on;
		PERFORM pg_catalog.set_config('search_path', '', false);
		SET check_function_bodies = false;
		SET xmloption = content;
		SET client_min_messages = warning;
		SET row_security = off;

		if to_regproc('migration.db_version') is not null then
			if (select migration.db_version()) = '#MIGRATION_VERSION_PLACEHOLDER#' then
				return;
			end if;
		end if;

		CREATE OR REPLACE FUNCTION migration.db_version() RETURNS text 
			LANGUAGE sql IMMUTABLE LEAKPROOF COST 1 
			AS $$SELECT '#MIGRATION_VERSION_PLACEHOLDER#'$$;

	MG

	. "$SCRIPT_DIR/build-ddls.sh"
	. "$SCRIPT_DIR/build-cls.sh"
	. "$SCRIPT_DIR/build-prefill.sh"
	
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
			RAISE;
		END;
		$ALTER_DB_DO_COMMAND$;
	MG

	} > /dist-db/${database}/${database}.define.sql 

	HASH=$(cat /dist-db/${database}/${database}.define.sql | sha256sum | cut -d ' ' -f 1)
	sed "s/#MIGRATION_VERSION_PLACEHOLDER#/$HASH/" -i /dist-db/${database}/${database}.define.sql
	echo "$HASH" > /dist/common/${database}.version;

done

echo
echo '<<<<<<<< done >>>>>>>>>>>>>>>>'
echo

echo '<<<<<<<<<< restart servers >>>>>>>>>>'
for subsystem in ext 
do
	curl -s http://${subsystem}_app:9580/app/${subsystem}/reload
done


