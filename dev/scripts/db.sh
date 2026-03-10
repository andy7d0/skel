#!/bin/sh

pwd

. ./dev/scripts/common.inc

OP=$1
shift

# database = server
DB_NAME=$1
shift

[ -n "$DB_NAME" ] || { echo no db; exit; }

psql() {
	./dev/scripts/compose.sh exec -T $DB_NAME psql -d $DB_NAME -U postgres "$@"
}

pg_isready() {
	./dev/scripts/compose.sh exec -T $DB_NAME pg_isready -U postgres -q
}

case "$OP" in
init)
	./dev/scripts/compose.sh down
	sleep 5
	./dev/scripts/compose.sh up $DB_NAME -d --wait
	until pg_isready
	do
		echo .
		sleep 1
	done

	psql -c "DROP DATABASE $DB_NAME WITH (FORCE);"
	read -p "Check drop db results, is db not existing? Ctrl+c if it is exinting now and need fix it. Or any key to continue.."

	cat "src/dumps/$DB_NAME-server.sql" | ./dev/scripts/compose.sh exec -T $DB_NAME psql -U postgres

	psql -c "CREATE DATABASE $DB_NAME;"
;;

dump)
	echo dump database $DB_NAME

	./dev/scripts/compose.sh exec -T $DB_NAME pg_dumpall -U postgres --globals-only --clean --if-exists \
		> ./src/dumps/$DB_NAME-server.sql

	echo dumped	
;;

migrate)
	echo migrate database $DB_NAME

	psql -f /var/lib/postgresql/def/$DB_NAME.define.sql
;;

psql)
	./dev/scripts/compose.sh exec $DB_NAME psql -d $DB_NAME -U postgres "$@"
;;

*)
	echo 'UNKNOWN OP'
;;

esac