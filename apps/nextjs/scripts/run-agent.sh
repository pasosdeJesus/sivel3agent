#!/bin/bash
# scripts/run-agent.sh
# Wrapper for the sivel3agent cron job. Runs the full pipeline:
#   scrape (RSS) → detect (LLM) → send (sivel.xyz)
#
# Reads PROJECT_DIR and LOG_DIR from ../../../.env if not set in environment.
# Falls back to /opt/sivel3agent and /var/log/sivel3agent.

set -e

# Resolve script directory to find .env relative to it
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../../.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

PROJECT_DIR="${SIVEL3AGENT_HOME:-/opt/sivel3agent}/apps/nextjs"
LOG_DIR="${SIVEL3AGENT_LOG_DIR:-/var/log/sivel3agent}"
LOG_FILE="$LOG_DIR/agent.log"
LOCK_FILE="/var/lock/sivel3agent.lock"
BATCH_SIZE="${BATCH_SIZE:-20}"

mkdir -p "$LOG_DIR"

if [ -f "$LOCK_FILE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Another instance is already running, exiting." >> "$LOG_FILE"
    exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

cd "$PROJECT_DIR" || exit 1

{
echo "========================================="
echo "$(date '+%Y-%m-%d %H:%M:%S'): Starting sivel3agent pipeline"

# 1. Scrape news (idempotent, fast, ~30s)
echo "$(date '+%Y-%m-%d %H:%M:%S'): [1/3] Scraping RSS feeds..."
DOTENV_CONFIG_PATH=../.env node_modules/.bin/tsx scripts/scrape-news.ts

# 2. Detect cases (LLM-heavy, slow, ~10-30 min depending on batch)
echo "$(date '+%Y-%m-%d %H:%M:%S'): [2/3] Detecting cases..."
DOTENV_CONFIG_PATH=../.env BATCH_SIZE=20 node_modules/.bin/tsx scripts/detect-cases.ts

# 3. Send pending pre_alerts to sivel.xyz
echo "$(date '+%Y-%m-%d %H:%M:%S'): [3/3] Sending to sivel.xyz..."
node_modules/.bin/tsx scripts/generate-and-send.ts

echo "$(date '+%Y-%m-%d %H:%M:%S'): Pipeline completed"
echo "========================================="
} >> "$LOG_FILE" 2>&1
