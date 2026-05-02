#!/usr/bin/env bash
# Smoke tests for the LinkedIn Translator backend.
# Run against a backend already booted at $HOST (default http://localhost:8000).

set -e
HOST="${HOST:-http://localhost:8000}"
SAMPLE='Thrilled to announce I have been humbled to join Acme as VP of Synergy. Beyond grateful for the team that believed in me on this incredible journey.'

echo "[1/5] healthz..."
curl -fsS "$HOST/healthz" | grep -q '"ok":true'
echo "  ok"

echo "[2/5] translate happy path..."
curl -fsS -X POST "$HOST/translate" \
  -H "Content-Type: application/json" \
  -d "{\"post_text\":\"$SAMPLE\"}" \
  | grep -q '"category"'
echo "  ok"

echo "[3/5] highlights happy path..."
curl -fsS -X POST "$HOST/highlights" \
  -H "Content-Type: application/json" \
  -d "{\"post_text\":\"$SAMPLE\"}" \
  | grep -q '"highlights"'
echo "  ok"

echo "[4/5] validation rejects empty..."
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/translate" \
  -H "Content-Type: application/json" -d '{"post_text":""}')
case "$status" in
  4*) echo "  ok ($status)" ;;
  *)  echo "  FAIL: expected 4xx, got $status"; exit 1 ;;
esac

echo "[5/5] CORS preflight from linkedin.com..."
curl -fsS -X OPTIONS "$HOST/translate" \
  -H "Origin: https://www.linkedin.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -D - -o /dev/null \
  | grep -i "access-control-allow-origin: https://www.linkedin.com" >/dev/null
echo "  ok"

echo
echo "all tests passed"
