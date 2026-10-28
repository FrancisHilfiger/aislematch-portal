#!/bin/sh
# Build and refresh the root portal.js that jsDelivr serves
set -e
sh build.sh
cp dist/portal.js portal.js
echo "Built portal.js - now commit, push and tag a release."
