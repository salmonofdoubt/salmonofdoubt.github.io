#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-master}"
MAX_ATTEMPTS="${SAFE_PUSH_MAX_ATTEMPTS:-6}"
BASE_DELAY_SECONDS="${SAFE_PUSH_BASE_DELAY_SECONDS:-4}"

if ! [[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "SAFE_PUSH_MAX_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Safe push attempt ${attempt}/${MAX_ATTEMPTS} for ${BRANCH}..."

  git fetch origin "$BRANCH"

  if ! git rebase "origin/$BRANCH"; then
    echo "Rebase conflict while preparing ${BRANCH}; refusing to guess." >&2
    git rebase --abort >/dev/null 2>&1 || true
    exit 1
  fi

  if git push origin "HEAD:$BRANCH"; then
    echo "Safe push succeeded on attempt ${attempt}."
    exit 0
  fi

  if [[ "$attempt" -eq "$MAX_ATTEMPTS" ]]; then
    echo "Safe push failed after ${MAX_ATTEMPTS} attempts." >&2
    exit 1
  fi

  delay=$((BASE_DELAY_SECONDS * attempt))
  echo "Remote moved during push; retrying after ${delay}s..."
  sleep "$delay"
done
