#!/bin/sh
# The golf engine runs in the browser (js/core.js) and on the server (supabase/functions/_shared/engine.js).
# This copies the browser file into a module for the server, so both always play the same golf.
cd "$(dirname "$0")/.."
{ echo "// GENERATED from js/core.js by tools/sync-engine.sh. Edit js/core.js, then re-run the script."; cat js/core.js; echo; echo "export { R, mulberry32, gaussR, gauss, hash, clamp, avg, sum, pick, HOLES, PTS, PAYF, SLOTS, UMB, SUB, SUBW, SUBN, KEYS, um, ovr, TOURS, isCol, UP, DOWN, CLASS, WEEKS, calendar, NAMES, CN, CONFS, COLLEGES, confOf, pool, COURSES, makeEvent, beginRound, simHole, endRound, finishEvent, initState, playHole, afterHole, windOf, rollProspect, ratingFor, winProbs, oddsLabel, FIELD, CUT };"; } > supabase/functions/_shared/engine.js
