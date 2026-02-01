#!/bin/bash
# Run this on a fresh Ubuntu 24.04 server

set -e

echo "=== EventBobbin Server Setup ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20

# Install pm2
npm install -g pm2

# Install Playwright system dependencies
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

# Clone repo (change URL if needed)
git clone https://github.com/dantaeyoung/eventbobbin.git
cd eventbobbin

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Copy your .env file to ~/eventbobbin/.env"
echo "2. Run: cd ~/eventbobbin && npm run build"
echo "3. Start with: pm2 start npm --name eventbobbin -- start"
echo "4. Save pm2 config: pm2 save && pm2 startup"
echo ""
