#!/usr/bin/env bash
# deploy.sh - run on web-01 and web-02. Safe to run repeatedly.
# Usage: bash deploy.sh web-01   (or web-02)
set -euo pipefail

SERVER_NAME="${1:?Usage: bash deploy.sh <web-01|web-02>}"
REPO="https://github.com/Kaylain7/farm-weather-dashboard.git"
APP_DIR="/var/www/farm-weather"
SITE="/etc/nginx/sites-available/farm-weather"

sudo apt-get update -y
sudo apt-get install -y nginx git

if [ -d "$APP_DIR/.git" ]; then
  sudo git -C "$APP_DIR" pull
else
  sudo git clone "$REPO" "$APP_DIR"
fi

echo "$SERVER_NAME" | sudo tee "$APP_DIR/host.txt" > /dev/null

# Back up any existing site config, then install ours
[ -f "$SITE" ] && sudo cp "$SITE" "$SITE.bak"
sudo sed "s/web-01/$SERVER_NAME/" "$APP_DIR/nginx/web.conf" | sudo tee "$SITE" > /dev/null
sudo ln -sf "$SITE" /etc/nginx/sites-enabled/farm-weather

sudo nginx -t
sudo systemctl reload nginx
echo "Deployed on $SERVER_NAME"
