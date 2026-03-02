#!/bin/bash

cat_file_with_header() {
	echo
	echo "__FILE__ = '$1';"
	echo "__START_LINE__ = 0;"
	cat $1
}
export -f cat_file_with_header

find /src -name "*.${database}.ddl" -print0 \
| sort -z \
| xargs -0 -n 1 -I "#" bash -c 'cat_file_with_header "#"' \
| sed '=' | sed -r 'N;s/^(\d+)\n__START_LINE__ = 0;/\1\n__START_LINE__ = \1;/;s/^\d+\n//' \
| sed -r -f ./extend-ddl.sed


