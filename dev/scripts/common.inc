#!/bin/bash
SERVER=$(git config --get remote.origin.url)

#echo "$ORIGIN" 
ZONE=${PWD##*/}
ZONEDIR="/var/s-ops/router/zones/$ZONE"
ZONEFILE="/var/s-ops/router/zones/$ZONE/docker-compose.yml"
echo "$SERVER" "$ZONE"
echo

remote() {
	ssh -o ClearAllForwardings=yes $SERVER "$@"
}

composeop() {
	# echo compose: $ZONEFILE
	remote docker compose -f $ZONEFILE "$@"
}

args() {
	echo 1 $1
	echo 2 $2
	echo 3 $3
	echo 4 $4
	echo 5 $5
	echo 6 $6
	echo 7 $7
	echo 8 $8
	echo 9 $9
	echo 10 ${10}
	echo 11 ${11}
}

remote_pg_command() {
	A=${2// /\\ }
	composeop exec -T $1 psql -U postgres -d $1 -c "$A"
}

remote_pg_file() {
	composeop exec -T $1 psql -U postgres -d $1 -f "$2"
}

remote_pg_pipe() {
	composeop exec -T $1 psql -U postgres -d $1
}
