#!/bin/bash

# kill_trap() {
# 	#kill $NF_PID
# 	wait $NF_PID
# 	kill -- -$$
# 	kill $(jobs -p)
# 	exit 0
# }

#trap kill_trap SIGINT SIGTERM EXIT



processor() {
	echo 'start src processing'
	( bash -c ./build.sh )
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

processor

exec 3< <( inotifywait -rm \
	--include "[.](txt|php|json|yml|toml|jsx|ddl|cs[.]mjs)$" \
	-e modify \
	-e create \
	-e delete \
	-e move \
	-e attrib \
	--format "%w%f" \
	/src \
)

NF_PID=$!
#ps
#echo nf $NF_PID

process_modify <&3 



