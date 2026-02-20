#!/bin/sh

[ -d /src ] && ./build.sh

cd "$DIST" && php app-main.php

