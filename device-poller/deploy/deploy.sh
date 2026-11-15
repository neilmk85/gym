#!/bin/bash
# Deploy adms-server to stayfit VPS.
# Usage: ./deploy/deploy.sh
# Prerequisites: ssh alias "dg" must work (or edit HOST below).

set -e

HOST="dg"
REMOTE_DIR="/opt/adms-server"
SERVICE="adms-server"

echo "==> Building Linux binary..."
GOOS=linux GOARCH=amd64 go build -o /tmp/adms-server ./cmd/adms-server/

echo "==> Uploading binary..."
ssh $HOST "mkdir -p $REMOTE_DIR"
scp /tmp/adms-server $HOST:$REMOTE_DIR/adms-server
ssh $HOST "chmod +x $REMOTE_DIR/adms-server"

echo "==> Uploading service file..."
scp deploy/adms-server.service $HOST:/etc/systemd/system/$SERVICE.service

echo ""
echo "==> Done uploading. Now on the VPS, run:"
echo "    1. Edit config:  nano $REMOTE_DIR/config.json"
echo "    2. Edit mapping: nano $REMOTE_DIR/mapping.json"
echo "    3. Enable port:  ufw allow 5077/tcp"
echo "    4. Enable svc:   systemctl daemon-reload && systemctl enable $SERVICE && systemctl start $SERVICE"
echo "    5. Check logs:   journalctl -fu $SERVICE"
