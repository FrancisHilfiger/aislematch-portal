#!/bin/sh
npx esbuild src/main.js --bundle --minify --format=iife --target=es2019 --loader:.css=text --legal-comments=none --outfile=dist/portal.js
