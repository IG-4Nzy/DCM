#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (e.g., sudo ./install_agent_linux.sh)"
  exit 1
fi

echo "=== DCM Heartbeat Agent Installer ==="

read -p "Enter DCM Backend URL (e.g. http://192.168.1.100:8000): " BACKEND_URL
read -p "Enter check interval in seconds [60]: " INTERVAL
INTERVAL=${INTERVAL:-60}

if [ -z "$BACKEND_URL" ]; then
    echo "Error: Backend URL is required."
    exit 1
fi

# Determine script location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ ! -f "$DIR/heartbeat_agent.py" ]; then
    echo "Error: heartbeat_agent.py not found in $DIR."
    exit 1
fi

# Copy script to standard location
cp "$DIR/heartbeat_agent.py" /usr/local/bin/dcm_heartbeat_agent.py
chmod +x /usr/local/bin/dcm_heartbeat_agent.py

# Create systemd service
cat <<EOF > /etc/systemd/system/dcm-heartbeat.service
[Unit]
Description=DCM Heartbeat Agent
After=network.target

[Service]
Type=simple
User=root
Environment="DCM_BACKEND_URL=${BACKEND_URL}"
Environment="INTERVAL_SECONDS=${INTERVAL}"
ExecStart=/usr/bin/python3 /usr/local/bin/dcm_heartbeat_agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable dcm-heartbeat
systemctl restart dcm-heartbeat

echo ""
echo "✅ Installation complete!"
echo "The agent is now running in the background and will automatically start on server reboot."
echo "You can check its status anytime with: sudo systemctl status dcm-heartbeat"
