#!/bin/bash

###############################################################################
# Setup Automatic Database Backups using Cron
# This script sets up cron jobs for daily, weekly, monthly, and yearly backups
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
CRON_LOG_DIR="$HOME/Backups/cron-logs"

# Create log directory
mkdir -p "$CRON_LOG_DIR"

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

echo "🔧 Setting up automatic database backups..."
echo "📝 Backup script: $BACKUP_SCRIPT"
echo ""

# Create temporary cron file
CRON_TEMP=$(mktemp)

# Get existing crontab (if any)
crontab -l > "$CRON_TEMP" 2>/dev/null || true

# Remove old backup cron jobs if they exist
sed -i '/backup-db.sh/d' "$CRON_TEMP"

# Add new cron jobs
echo "" >> "$CRON_TEMP"
echo "# Sales Dashboard Database Backups" >> "$CRON_TEMP"
echo "# Daily backup at 2:00 AM" >> "$CRON_TEMP"
echo "0 2 * * * $BACKUP_SCRIPT daily >> $CRON_LOG_DIR/daily-backup.log 2>&1" >> "$CRON_TEMP"
echo "" >> "$CRON_TEMP"
echo "# Weekly backup every Sunday at 3:00 AM" >> "$CRON_TEMP"
echo "0 3 * * 0 $BACKUP_SCRIPT weekly >> $CRON_LOG_DIR/weekly-backup.log 2>&1" >> "$CRON_TEMP"
echo "" >> "$CRON_TEMP"
echo "# Monthly backup on the 1st of each month at 4:00 AM" >> "$CRON_TEMP"
echo "0 4 1 * * $BACKUP_SCRIPT monthly >> $CRON_LOG_DIR/monthly-backup.log 2>&1" >> "$CRON_TEMP"
echo "" >> "$CRON_TEMP"
echo "# Yearly backup on January 1st at 5:00 AM" >> "$CRON_TEMP"
echo "0 5 1 1 * $BACKUP_SCRIPT yearly >> $CRON_LOG_DIR/yearly-backup.log 2>&1" >> "$CRON_TEMP"

# Install the new crontab
crontab "$CRON_TEMP"
rm "$CRON_TEMP"

echo "✅ Cron jobs installed successfully!"
echo ""
echo "📋 Current crontab entries:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
crontab -l | grep -A 1 "backup-db.sh" || echo "No backup jobs found"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 Backup Schedule:"
echo "   • Daily:    Every day at 2:00 AM (keeps 30 days)"
echo "   • Weekly:   Every Sunday at 3:00 AM (keeps 90 days)"
echo "   • Monthly:  First day of month at 4:00 AM (keeps 365 days)"
echo "   • Yearly:   January 1st at 5:00 AM (keeps 10 years)"
echo ""
echo "📁 Backup locations:"
echo "   • Daily:    ~/Backups/DatabaseBackups/daily/"
echo "   • Weekly:   ~/Backups/DatabaseBackups/weekly/"
echo "   • Monthly:  ~/Backups/DatabaseBackups/monthly/"
echo "   • Yearly:   ~/Backups/DatabaseBackups/yearly/"
echo ""
echo "📝 Log files: $CRON_LOG_DIR/"
echo ""
echo "🔍 To view cron logs:"
echo "   tail -f $CRON_LOG_DIR/daily-backup.log"
echo ""
echo "🔍 To view all cron jobs:"
echo "   crontab -l"
echo ""
echo "🗑️  To remove backup cron jobs:"
echo "   crontab -e  # Then delete the backup-db.sh lines"

