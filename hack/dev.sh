#!/usr/bin/env bash
set -euo pipefail

# Build pages assets into backend/static so the embedded FS serves them
echo "Building pages assets..."
helm template console-functions-plugin charts/openshift-console-plugin \
  -n console-functions-plugin \
  --set plugin.image=ghcr.io/functions-dev/console-functions-plugin:latest \
  > backend/static/plugin.yaml
cp pages/index.html backend/static/index.html

# Track background PIDs for cleanup
PIDS=()
cleanup() {
  echo ""
  echo "Stopping dev servers..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -f backend/static/plugin.yaml backend/static/index.html
  wait
}
trap cleanup EXIT

# Start backend API server (also serves pages via embedded static files)
echo "Starting backend server on :8080..."
(cd backend && go run ./main.go -http-port 8080) &
PIDS+=($!)

# Start webpack dev server
echo "Starting webpack dev server..."
yarn webpack serve --progress &
PIDS+=($!)

echo ""
echo "Dev environment running:"
echo "  Backend: http://localhost:8080"
echo "  Plugin:  http://localhost:9001"
echo ""

wait
