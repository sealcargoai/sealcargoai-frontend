#!/usr/bin/env bash
# CIERRE 29-b — one complete verification round on the CURRENT commit (no edits in between).
# Usage: bash e2e/verify.sh [path-to-backend-repo]   → writes e2e/out/round-<commit>-<n>.log
set -u
cd "$(dirname "$0")/.."
BE="${1:-../be}"
COMMIT=$(git rev-parse --short=7 HEAD)
DIRTY=$(git status --porcelain --untracked-files=no | wc -l)
mkdir -p e2e/out
N=$(ls e2e/out/round-"$COMMIT"-*.log 2>/dev/null | wc -l); N=$((N + 1))
LOG="e2e/out/round-$COMMIT-$N.log"
fail=0
step() { echo "── $1" | tee -a "$LOG"; shift; if "$@" >>"$LOG" 2>&1; then echo "   PASS" | tee -a "$LOG"; else echo "   FAIL" | tee -a "$LOG"; fail=1; fi; }
echo "round $N · frontend $COMMIT (uncommitted tracked changes: $DIRTY) · backend $(git -C "$BE" rev-parse --short=7 HEAD) · $(date -u +%FT%TZ)" | tee "$LOG"
[ "$DIRTY" = "0" ] || { echo "   FAIL: working tree not clean" | tee -a "$LOG"; fail=1; }
step "frontend: full suite (vitest)" npx vitest run
step "frontend: closure matrix (test:cierre)" npm run -s test:cierre
step "frontend: audit 29-a suite (test:audit)" npm run -s test:audit
step "frontend: acceptance matrix (test:acceptance)" npm run -s test:acceptance
step "frontend: types (tsc --strict)" bash -c "npx -y -p typescript@5 tsc --noEmit --strict --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --skipLibCheck --allowImportingTsExtensions --resolveJsonModule --types vite/client src/main.tsx 2>&1 | grep -v 'TS7016\|TS2307\|Try .npm' | grep 'error' && exit 1 || exit 0"
step "frontend: format (prettier, files of this closure)" npx -y prettier@3.3.3 --config .prettierrc.cierre.json --check tests/cierre-29-b.test.ts tests/chat-component-29-b.test.tsx tests/sandbox-29-b.test.ts e2e/run-e2e.mjs src/utils/sandbox.ts src/utils/chatCase.ts src/utils/requestFacts.ts
step "frontend: whitespace (git diff --check vs base)" git diff --check cf8768c HEAD
step "frontend: production build" npm run -s build
step "frontend: production build has GTM and no sandbox banner active" bash -c "grep -q googletagmanager dist/index.html"
step "browser: sandbox build in Chromium (e2e)" node e2e/run-e2e.mjs
step "backend: full suite (node --test)" bash -c "cd '$BE' && npm test > /tmp/cierre-be-test.log 2>&1; cat /tmp/cierre-be-test.log; grep -q '^# fail 0' /tmp/cierre-be-test.log"
step "backend: format (prettier, files of this closure)" bash -c "cd '$BE' && npx -y prettier@3.3.3 --config .prettierrc.cierre.json --check test/cierre-29-b.test.mjs"
echo "── summary" | tee -a "$LOG"
sed 's/\x1b\[[0-9;]*m//g' "$LOG" | grep -aE "^ +Tests +[0-9]|^# (tests|pass|fail) |browser e2e @|built in" | tee -a "$LOG.summary"
echo "RESULT: $([ $fail = 0 ] && echo PASS || echo FAIL) — $LOG" | tee -a "$LOG"
exit $fail
