#!/bin/bash
# Restart the Cloudflare quick tunnel for Blueprint Flow and print the link.
# Usage:  ./tunnel.sh
set -e

# make sure the app itself is up
if ! curl -sf --max-time 5 http://localhost:3000/login >/dev/null; then
  echo "App is not running on :3000 — starting it…"
  (cd "$(dirname "$0")" && nohup npm run start > /tmp/bf-prod.log 2>&1 &)
  for i in $(seq 1 45); do
    curl -sf --max-time 5 http://localhost:3000/login >/dev/null && break
    sleep 1
  done
fi

pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 2
nohup cloudflared tunnel --url http://localhost:3000 > /tmp/bf-tunnel.log 2>&1 &
echo "Starting tunnel…"
for i in $(seq 1 20); do
  URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/bf-tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Tunnel failed to start — see /tmp/bf-tunnel.log"
  exit 1
fi

# wait until the public URL actually serves
for i in $(seq 1 6); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$URL/login" || true)
  [ "$CODE" = "200" ] && break
  sleep 5
done

echo ""
echo "  Share this link:  $URL"
echo ""
