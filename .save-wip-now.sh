#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(pwd)/.save-wip-result.txt"
BRANCH="backup/wip-before-project-switch-20260515"
{
  echo "=== git status ==="
  git status --short
  echo
  echo "=== branch before ==="
  git branch --show-current
  git rev-parse HEAD
  echo
  git branch -f "$BRANCH" HEAD 2>/dev/null || git branch "$BRANCH"
  echo "=== backup branch: $BRANCH ==="
  git add -A
  if git diff --cached --quiet; then
    echo "=== nothing to commit (working tree clean after add) ==="
  else
    git commit -m "$(cat <<'EOF'
WIP: save before switching Cursor project (May 15 2026).

IIZI scripted exact-speech flow and related orchestrator work.
EOF
)"
  fi
  echo "=== after ==="
  git rev-parse HEAD
  git log -1 --oneline
  git status --short
} >"$OUT" 2>&1
echo "Wrote $OUT"
