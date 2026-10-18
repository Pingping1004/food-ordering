#!/bin/sh
# Rebuild into .next-lh, restart the production server on :3200, run Lighthouse. Usage: scripts/lh-cycle.sh /login
cd "$(dirname "$0")/.." || exit 1
pkill -f "next start -p 3200" 2>/dev/null; sleep 1
NEXT_DIST_DIR=.next-lh NEXT_TELEMETRY_DISABLED=1 npx next build 2>&1 | grep -E "Failed|rror:|First Load JS shared|/school/\[schoolId\] "
(NEXT_DIST_DIR=.next-lh nohup npx next start -p 3200 >"${TMPDIR:-/tmp}/lh-server.log" 2>&1 &)
sleep 6
LH_RUNS="${LH_RUNS:-3}" node scripts/lighthouse.mjs "${1:-/login}"
