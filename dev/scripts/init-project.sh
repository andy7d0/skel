#!/bin/sh
mkdir -p .git/hooks
cd .git/hooks
ln -s ../../dev/scripts/post-checkout post-checkout  

cd ../..
dev/scripts/post-checkout
