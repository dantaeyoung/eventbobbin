#!/bin/bash
cd "$(dirname "$0")"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm use 20

git pull origin main
npm install
npm run build
pm2 restart eventbobbin

echo "✓ Deployed!"
