#!/bin/bash
# Sync database from VPS to local for testing

SERVER="root@YOUR_SERVER_IP"  # Change this to your server
REMOTE_PATH="/var/www/eventbobbin/data/events.db"
LOCAL_PATH="$(dirname "$0")/data/events.db"

echo "Pulling database from VPS..."
scp "$SERVER:$REMOTE_PATH" "$LOCAL_PATH"
echo "✓ Database synced!"
