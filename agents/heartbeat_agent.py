import os
import sys
import time
import json
import socket
import urllib.request
import urllib.error

# Configuration
# Read from env or use defaults
DCM_BACKEND_URL = os.environ.get("DCM_BACKEND_URL", "http://localhost:8000")
INTERVAL_SECONDS = int(os.environ.get("INTERVAL_SECONDS", 60))
IP_ADDRESS = os.environ.get("IP_ADDRESS", "")

def get_local_ip():
    if IP_ADDRESS:
        return IP_ADDRESS
    try:
        # Connect to a public DNS to get the default routing IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def send_heartbeat():
    ip = get_local_ip()
    hostname = socket.gethostname()
    
    url = f"{DCM_BACKEND_URL.rstrip('/')}/api/server-ping-monitoring/heartbeat"
    payload = {
        "ipAddress": ip,
        "hostname": hostname,
        "status": "UP"
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status in (200, 201):
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Heartbeat sent successfully for {hostname} ({ip})")
            else:
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Warning: Server responded with status {response.status}")
    except urllib.error.URLError as e:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Error sending heartbeat: {e.reason}")
    except Exception as e:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Unexpected error: {e}")

if __name__ == "__main__":
    print(f"Starting DCM Heartbeat Agent...")
    print(f"Target Backend: {DCM_BACKEND_URL}")
    print(f"Interval: {INTERVAL_SECONDS} seconds")
    print(f"Local IP: {get_local_ip()}")
    print("-" * 50)
    
    while True:
        send_heartbeat()
        time.sleep(INTERVAL_SECONDS)
