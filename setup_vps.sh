#!/bin/bash
# setup_vps.sh — Chạy 1 lần trên VPS để setup môi trường
# Usage: bash setup_vps.sh

echo "=== MKT Content Factory — VPS Setup ==="

# Tạo thư mục
mkdir -p /root/mkt_factory
cd /root/mkt_factory

# Install Node nếu chưa có
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

# Copy files (chạy từ local bằng scp/rsync trước)
# Sau đó install deps:
if [ -f package.json ]; then
    npm install --production
    echo "✅ Dependencies installed"
fi

# Tạo systemd service cho callback_handler (chạy 24/7)
cat > /etc/systemd/system/mkt-callback.service << 'EOF'
[Unit]
Description=MKT Factory Telegram Callback Handler
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/mkt_factory
ExecStart=/usr/bin/node /root/mkt_factory/callback_handler.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mkt-callback
systemctl start mkt-callback

echo "✅ Callback handler service started"
echo ""
echo "=== Commands ==="
echo "Xem logs:    journalctl -u mkt-callback -f"
echo "Gửi review:  node /root/mkt_factory/load_batch_tuan1.js"
echo "Đăng ngay:   node /root/mkt_factory/publish_queue.js --post_id <id>"
echo "Lên lịch:    node /root/mkt_factory/publish_queue.js --scheduled"
