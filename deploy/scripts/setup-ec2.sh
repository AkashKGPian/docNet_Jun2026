#!/usr/bin/env bash
# DocNet MVP — EC2 first-time setup (Ubuntu 24.04)
# Run as ubuntu user after SSH: bash deploy/scripts/setup-ec2.sh
set -euo pipefail

REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/home/ubuntu/DocNetMVP}"

if [[ -z "$REPO_URL" ]]; then
  echo "Set REPO_URL to your git clone URL, e.g.:"
  echo "  REPO_URL=https://github.com/you/DocNetMVP.git bash deploy/scripts/setup-ec2.sh"
  exit 1
fi

echo "==> Installing system packages..."
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2

echo "==> Cloning repository..."
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

echo "==> Installing server dependencies..."
cd server && npm install --production

echo "==> Installing client dependencies..."
cd ../client && npm install

echo ""
echo "==> Next steps (manual):"
echo "  1. Copy deploy/env/server.env.production.example → server/.env and fill values"
echo "  2. Copy client/.env.production.example → client/.env.production and set Elastic IP"
echo "  3. cd client && npm run build"
echo "  4. pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup"
echo "  5. sudo cp deploy/nginx/docnet.conf /etc/nginx/sites-available/docnet"
echo "     Edit server_name, then:"
echo "     sudo ln -sf /etc/nginx/sites-available/docnet /etc/nginx/sites-enabled/docnet"
echo "     sudo rm -f /etc/nginx/sites-enabled/default"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "See deploy/AWS_SETUP.md and deploy/VERIFY.md for full checklist."
