#!/bin/sh
# Builds js/online.js: the helper lines shared with the solo game (top of js/game.js), then the online game.
# The online game has its own career ages, so the solo game's ageOf and tourLabel are left out.
cd "$(dirname "$0")/.." || exit 1
SRC="${1:-src/online.src.js}"
{ echo '/* Range Rat online. Built by tools/build-online.sh: helpers shared with the solo game come first. */'
  sed -n 2,29p js/game.js | grep -v '^const KEY=' | grep -v '^const ageOf=' | grep -v '^const tourLabel='
  cat "$SRC"; } > js/online.js
node -e "new Function(require('fs').readFileSync('js/online.js','utf8'))" || exit 1
# Stamp the page's links so browsers fetch the new files instead of an old cached copy.
V=$(date -u +%Y%m%d%H%M%S)
sed -i -E "s#(css/style\.css|js/core\.js|js/online\.js|js/config\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
echo "built js/online.js (version $V)"
