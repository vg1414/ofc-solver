#!/bin/sh
# Bygger och kör ett script: sh scripts/run.sh scripts/x.ts args...
f=$1; shift
out="${TMPDIR:-/tmp}/ofc-$(basename $f .ts).mjs"
npx rolldown "$f" --format esm --platform node --file "$out" --log-level warn >/dev/null && node "$out" "$@"
