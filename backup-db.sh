#!/bin/bash

###############################################################################
# Database Backup Script for Sales Dashboard
# Supports: Daily, Weekly, Monthly, Yearly backups
# Database: PostgreSQL
###############################################################################

set -o pipefail  # Catch failures inside pipes (e.g. pg_dump | gzip)

# ─── Configuration ────────────────────────────────────────────────────────────
BACKUP_BASE_DIR="$HOME/kloud/Backups/DatabaseBackups"
VM_HOST="kloud@172.31.82.254"
SSH_KEY="$HOME/.ssh/backup_key"   # Path to SSH private key for passwordless login
DB_USER="sales_user"
DB_NAME="sales_dashboard_db"
DB_HOST="127.0.0.1"               # TCP connection — bypasses peer authentication
DB_PORT="5432"

# ─── Load DB password ─────────────────────────────────────────────────────────
# Source a local secrets file if it exists (recommended — keep out of git)
SECRETS_FILE="$HOME/.backup_secrets"
if [ -f "$SECRETS_FILE" ]; then
    # shellcheck source=/dev/null
    source "$SECRETS_FILE"
fi

# DB_PASSWORD must be set — either in ~/.backup_secrets or exported in the environment
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ DB_PASSWORD is not set."
    echo ""
    echo "   Fix: create $SECRETS_FILE with:"
    echo "     echo 'DB_PASSWORD=your_actual_password' > $SECRETS_FILE"
    echo "     chmod 600 $SECRETS_FILE"
    echo ""
    echo "   Find the password on the remote server:"
    echo "     ssh $VM_HOST \"find /opt /home/kloud -name '.env' | xargs grep DB_PASSWORD 2>/dev/null\""
    exit 1
fi

# Minimum valid backup size in bytes (anything <= 100 bytes is an empty gzip)
MIN_BACKUP_BYTES=1024

# Backup type: daily, weekly, monthly, yearly (default: daily)
BACKUP_TYPE="${1:-daily}"

# ─── Directories ──────────────────────────────────────────────────────────────
DAILY_DIR="$BACKUP_BASE_DIR/daily"
WEEKLY_DIR="$BACKUP_BASE_DIR/weekly"
MONTHLY_DIR="$BACKUP_BASE_DIR/monthly"
YEARLY_DIR="$BACKUP_BASE_DIR/yearly"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR" "$YEARLY_DIR"

# ─── Timestamps ───────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
WEEK=$(date +"%Y-W%V")
MONTH=$(date +"%Y%m")
YEAR=$(date +"%Y")

# ─── Resolve backup path by type ──────────────────────────────────────────────
case "$BACKUP_TYPE" in
    daily)
        BACKUP_DIR="$DAILY_DIR"
        BACKUP_FILE="$BACKUP_DIR/sales_dashboard_daily_$TIMESTAMP.sql.gz"
        RETENTION_DAYS=30
        ;;
    weekly)
        BACKUP_DIR="$WEEKLY_DIR"
        BACKUP_FILE="$BACKUP_DIR/sales_dashboard_weekly_$WEEK.sql.gz"
        RETENTION_DAYS=90
        ;;
    monthly)
        BACKUP_DIR="$MONTHLY_DIR"
        BACKUP_FILE="$BACKUP_DIR/sales_dashboard_monthly_$MONTH.sql.gz"
        RETENTION_DAYS=365
        ;;
    yearly)
        BACKUP_DIR="$YEARLY_DIR"
        BACKUP_FILE="$BACKUP_DIR/sales_dashboard_yearly_$YEAR.sql.gz"
        RETENTION_DAYS=3650
        ;;
    *)
        echo "❌ Invalid backup type: $BACKUP_TYPE"
        echo "   Usage: $0 [daily|weekly|monthly|yearly]"
        exit 1
        ;;
esac

# ─── Helper: clean up a failed/empty backup file ──────────────────────────────
cleanup_failed() {
    if [ -f "$BACKUP_FILE" ]; then
        rm -f "$BACKUP_FILE"
        echo "   Removed incomplete backup file."
    fi
}

echo "🔄 Starting $BACKUP_TYPE backup..."
echo "📁 Backup directory: $BACKUP_DIR"
echo "📄 Backup file: $(basename "$BACKUP_FILE")"

# ─── SSH connectivity check ───────────────────────────────────────────────────
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
if [ -f "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

echo "🔌 Testing SSH connection to $VM_HOST..."
if ! ssh $SSH_OPTS "$VM_HOST" "echo connected" > /dev/null 2>&1; then
    echo "❌ Cannot connect to $VM_HOST via SSH."
    echo ""
    echo "   Fix: Set up SSH key authentication:"
    echo "     ssh-keygen -t ed25519 -f $SSH_KEY"
    echo "     ssh-copy-id -i ${SSH_KEY}.pub $VM_HOST"
    exit 1
fi
echo "   SSH connection OK."

# ─── Verify pg_dump is available on the remote host ──────────────────────────
if ! ssh $SSH_OPTS "$VM_HOST" "command -v pg_dump" > /dev/null 2>&1; then
    echo "❌ pg_dump not found on $VM_HOST. Install postgresql-client."
    exit 1
fi

# ─── Run pg_dump over SSH ─────────────────────────────────────────────────────
# The remote server must have a ~/.pgpass entry for sales_user:
#   127.0.0.1:5432:sales_dashboard_db:sales_user:YOUR_PASSWORD
# Set it up with:
#   echo "127.0.0.1:5432:sales_dashboard_db:sales_user:YOUR_PASSWORD" >> ~/.pgpass
#   chmod 600 ~/.pgpass
echo "📥 Downloading database backup from $VM_HOST..."

STDERR_FILE=$(mktemp)
ssh $SSH_OPTS "$VM_HOST" \
    "PGPASSWORD='$DB_PASSWORD' pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME | gzip" \
    > "$BACKUP_FILE" \
    2>"$STDERR_FILE"
SSH_EXIT=$?

# ─── Check for SSH/pg_dump errors ────────────────────────────────────────────
if [ $SSH_EXIT -ne 0 ]; then
    echo "❌ Backup command failed (exit code $SSH_EXIT)."
    if [ -s "$STDERR_FILE" ]; then
        echo "   Remote error output:"
        sed 's/^/   /' "$STDERR_FILE"
    fi
    rm -f "$STDERR_FILE"
    cleanup_failed
    exit 1
fi
rm -f "$STDERR_FILE"

# ─── Validate that the file has real content (not an empty gzip) ─────────────
ACTUAL_BYTES=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo 0)
if [ "$ACTUAL_BYTES" -le "$MIN_BACKUP_BYTES" ]; then
    echo "❌ Backup file is too small ($ACTUAL_BYTES bytes) — pg_dump likely produced no output."
    echo ""
    echo "   Common causes:"
    echo "   1. Missing ~/.pgpass on $VM_HOST for $DB_USER@$DB_HOST"
    echo "      Fix: ssh $VM_HOST"
    echo "           echo \"$DB_HOST:$DB_PORT:$DB_NAME:$DB_USER:YOUR_PASSWORD\" >> ~/.pgpass"
    echo "           chmod 600 ~/.pgpass"
    echo "   2. PostgreSQL not listening on TCP ($DB_HOST:$DB_PORT)"
    echo "      Fix: check pg_hba.conf has: host $DB_NAME $DB_USER 127.0.0.1/32 md5"
    echo "   3. $DB_USER does not have CONNECT privilege on $DB_NAME"
    cleanup_failed
    exit 1
fi

# ─── Verify the gzip file is not corrupt ─────────────────────────────────────
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "❌ Backup file is corrupt (failed gzip integrity check)."
    cleanup_failed
    exit 1
fi

# ─── Success ──────────────────────────────────────────────────────────────────
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup completed successfully!"
echo "   File: $BACKUP_FILE"
echo "   Size: $FILE_SIZE ($ACTUAL_BYTES bytes)"

# ─── Retention cleanup ────────────────────────────────────────────────────────
echo "🧹 Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "sales_dashboard_${BACKUP_TYPE}_*.sql.gz" -mtime +$RETENTION_DAYS -delete

BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/sales_dashboard_${BACKUP_TYPE}_*.sql.gz 2>/dev/null | wc -l)
echo "📊 Total $BACKUP_TYPE backups: $BACKUP_COUNT"

exit 0
