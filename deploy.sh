#!/usr/bin/env bash
# deploy.sh - deploy the Farm Weather Dashboard under /farm/ on web-01 or web-02.
# Safe to run repeatedly. Usage: bash deploy.sh web-01   (or web-02)
set -euo pipefail

SERVER_NAME="${1:?Usage: bash deploy.sh <web-01|web-02>}"
REPO_URL="https://github.com/Kaylain7/farm-weather-dashboard.git"
REPO_DIR="/opt/farm-weather-repo"        # full clone, NOT served by nginx
WEB_DIR="/var/www/farm-weather"          # only the app files, served by nginx
SNIPPET="/etc/nginx/snippets/farm-weather.conf"
SITE="/etc/nginx/sites-available/default"

sudo apt-get update -y
sudo apt-get install -y nginx git rsync

# 1. Get the latest code
if [ -d "$REPO_DIR/.git" ]; then
  sudo git -C "$REPO_DIR" pull
else
  sudo git clone "$REPO_URL" "$REPO_DIR"
fi

# 2. Copy only the files the browser needs (no .git, tools, scripts or configs)
sudo mkdir -p "$WEB_DIR"
sudo rsync -a --delete \
  --exclude .git --exclude .gitignore --exclude tools --exclude nginx \
  --exclude haproxy --exclude deploy.sh --exclude README.md --exclude host.txt \
  "$REPO_DIR"/ "$WEB_DIR"/
echo "$SERVER_NAME" | sudo tee "$WEB_DIR/host.txt" > /dev/null
sudo chmod -R a+rX "$WEB_DIR"

# 3. Install the nginx snippet and include it once in the existing default site
sudo mkdir -p /etc/nginx/snippets
sudo cp "$REPO_DIR/nginx/farm-weather.conf" "$SNIPPET"
[ -f "$SITE.bak" ] || sudo cp "$SITE" "$SITE.bak"
if ! grep -q "farm-weather.conf" "$SITE"; then
  sudo sed -i '/server_name _;/a\    include /etc/nginx/snippets/farm-weather.conf;' "$SITE"
fi

# 4. Check the config and reload
sudo nginx -t
sudo service nginx reload
sleep 2

# 5. Verify
status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/farm/)
echo "http://localhost/farm/ returned HTTP $status on $SERVER_NAME"
[ "$status" = "200" ]
