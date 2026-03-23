#!/bin/sh

cargo build --target x86_64-unknown-linux-musl

cp target/x86_64-unknown-linux-musl/debug/build-api-entries ./build-jsx