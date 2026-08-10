#!/bin/bash

# Configuration
BACKEND_URL=${DCM_BACKEND_URL:-"http://localhost:8000"}
INTERVAL=${INTERVAL_SECONDS:-60}
IP=${IP_ADDRESS:-""}

if [ -z "$IP" ]; then
    # Try to get the default route IP
    IP=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')
    if [ -z "$IP" ]; then
        IP=$(hostname -I | awk '{print $1}')
    fi
fi

HOSTNAME=$(hostname)
URL="${BACKEND_URL%/}/api/server-ping-monitoring/heartbeat"

echo "Starting DCM Heartbeat Agent for Linux..."
echo "Target Backend: $URL"
echo "Interval: $INTERVAL seconds"
echo "Local IP: $IP"
echo "Hostname: $HOSTNAME"
echo "--------------------------------------------------"

while true; do
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    PAYLOAD="{\"ipAddress\": \"$IP\", \"hostname\": \"$HOSTNAME\", \"status\": \"UP\"}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$PAYLOAD" --connect-timeout 10 "$URL")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo "[$TIMESTAMP] Heartbeat sent successfully for $HOSTNAME ($IP)"
    else
        echo "[$TIMESTAMP] Error sending heartbeat. HTTP Code: $HTTP_CODE"
    fi
    
    sleep "$INTERVAL"
done
