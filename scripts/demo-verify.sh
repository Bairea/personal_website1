#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
MODE="${2:-skip-build}"

if [[ "${MODE}" == "build" ]]; then
  echo "== Build =="
  npm run build >/dev/null
fi

echo "== Page Checks =="
curl -fsS "${BASE_URL}/" >/dev/null
curl -fsS "${BASE_URL}/search/" >/dev/null
curl -fsS "${BASE_URL}/map/" >/dev/null
curl -fsS "${BASE_URL}/chat/" >/dev/null
echo "Pages OK"

echo "== API /search =="
curl -fsS "${BASE_URL}/api/search?q=hugo&mode=lexical" | grep -q '"ok":true'
curl -fsS "${BASE_URL}/api/search?q=hugo&mode=vector" | grep -q '"ok":true'
curl -fsS "${BASE_URL}/api/search?q=hugo&mode=hybrid" | grep -q '"ok":true'
echo "Search API OK"

echo "== API /chat =="
curl -fsS -X POST "${BASE_URL}/api/chat" \
  -H "content-type: application/json" \
  -d '{"q":"我不熟悉，请给我学习路线","unfamiliar":true}' | grep -q '"ok":true'
echo "Chat API OK"

echo "== API /graph =="
curl -fsS "${BASE_URL}/api/graph?kind=links" | grep -q '"ok":true'
curl -fsS "${BASE_URL}/api/graph?kind=tags" | grep -q '"ok":true'
curl -fsS "${BASE_URL}/api/graph?kind=entity" | grep -q '"ok":true'
echo "Graph API OK"

echo "== Feedback Export =="
curl -fsS "${BASE_URL}/api/feedback/export.json" >/dev/null
curl -fsS "${BASE_URL}/api/feedback/export.csv" >/dev/null
echo "Feedback export OK"

echo "All demo checks passed."
