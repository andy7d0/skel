#!/bin/bash

#trap 'kill $(jobs -p)' EXIT

kill_trap() {
	trap - SIGTERM
	kill 0
}

trap kill_trap SIGINT SIGTERM EXIT



processor() {
	echo 'start src processing'
	sleep 5
	echo 'end src processing'
}

# build command starts in parallel
# if not started
# it it is started already
# set flag: redo

process_modify() {

	while read line
	do
		echo file changes detected
		echo inf: $line
		while read -t 1 line2; do echo inf2: $line2; done
		echo files stabilized, so call processing
		processor
	done

}

# запускаем вотчет

inotifywait -rm \
	--include "[.]txt$" \
	-e modify \
	-e create \
	-e delete \
	-e move \
	-e attrib \
	--format "%w%f" \
	. \
| process_modify


