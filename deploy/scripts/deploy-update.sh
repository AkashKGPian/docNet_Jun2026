#!/usr/bin/env bash
# DocNet MVP — pull latest code and restart (run on EC2)
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/DocNetMVP}"
cd "$APP_DIR"

git pull

cd server && npm install --production
cd ../client && npm install && npm run build

pm2 restart docnet-api || pm2 start deploy/ecosystem.config.js
pm2 save

sudo nginx -t && sudo systemctl reload nginx

echo "Deploy complete."
