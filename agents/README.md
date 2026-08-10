# DCM Heartbeat Agents

This folder contains standalone agent scripts designed to run on your servers (Windows, Linux, Physical Machines, VMs, etc.). These agents periodically send a "heartbeat" signal to the DCM backend to indicate that the server is online.

If a server misses its heartbeat window, the DCM monitoring system will automatically flag it as offline and dispatch alerts.

---

## ⭐ Quick Installers (Recommended)
The easiest way to install the agents and ensure they **survive server reboots automatically** is to use the provided installer scripts. These scripts configure the agents as background services that start on boot.

### **Linux / Ubuntu Automated Install**
Run this installer as root. It will copy the python agent, configure a `systemd` service, and start it.
```bash
sudo ./install_agent_linux.sh
```

### **Windows Automated Install**
Run this installer from an **Administrator PowerShell** window. It will create a hidden Scheduled Task attached to the `SYSTEM` account that runs the agent on every boot.
```powershell
.\install_agent_windows.ps1
```

---

## 1. Linux / Ubuntu (Bash Script)
The bash script (`heartbeat_agent.sh`) is the most lightweight option for Linux-based systems. It uses standard tools like `curl`.

### **Running manually (Foreground)**
```bash
# Make the script executable
chmod +x heartbeat_agent.sh

# Run the script
export DCM_BACKEND_URL="http://<YOUR_DCM_BACKEND_IP>:8000"
export INTERVAL_SECONDS=60
./heartbeat_agent.sh
```

### **Running in the background**
To keep the agent running after you close your SSH session, use `nohup`:
```bash
export DCM_BACKEND_URL="http://<YOUR_DCM_BACKEND_IP>:8000"
nohup ./heartbeat_agent.sh > agent.log 2>&1 &
```

### **Stopping the background agent**
```bash
# Find the process ID
ps aux | grep heartbeat_agent.sh

# Kill the process
kill -9 <PROCESS_ID>
```

---

## 2. Windows (PowerShell Script)
The PowerShell script (`heartbeat_agent.ps1`) is natively supported on modern Windows servers.

### **Running manually (Foreground)**
Open PowerShell and run:
```powershell
.\heartbeat_agent.ps1 -BackendUrl "http://<YOUR_DCM_BACKEND_IP>:8000" -IntervalSeconds 60
```

### **Running in the background (As a Scheduled Task)**
To ensure the agent runs continuously on Windows without keeping a window open:
1. Open **Task Scheduler** in Windows.
2. Click **Create Basic Task**.
3. Name it "DCM Heartbeat Agent".
4. Set the Trigger to **"When the computer starts"**.
5. Set the Action to **"Start a program"**.
6. Under "Program/script", type: `powershell.exe`
7. Under "Add arguments", type: 
   `-WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\path\to\heartbeat_agent.ps1" -BackendUrl "http://<YOUR_DCM_BACKEND_IP>:8000"`
8. Save and run the task.

### **Stopping the scheduled task**
Simply open Task Scheduler, find "DCM Heartbeat Agent", right-click it, and select **End** or **Disable**.

---

## 3. Cross-Platform (Python Script)
If you have Python 3 installed on your server, you can use the `heartbeat_agent.py` script. It has no external dependencies.

### **Running manually (Foreground)**
```bash
# On Linux / Mac
export DCM_BACKEND_URL="http://<YOUR_DCM_BACKEND_IP>:8000"
python3 heartbeat_agent.py

# On Windows
set DCM_BACKEND_URL=http://<YOUR_DCM_BACKEND_IP>:8000
python heartbeat_agent.py
```

### **Running in the background (Linux)**
```bash
export DCM_BACKEND_URL="http://<YOUR_DCM_BACKEND_IP>:8000"
nohup python3 heartbeat_agent.py > agent.log 2>&1 &
```

### **Running as a Linux Systemd Service (Recommended for Production Linux)**
1. Create a service file: `sudo nano /etc/systemd/system/dcm-heartbeat.service`
2. Add the following content:
```ini
[Unit]
Description=DCM Heartbeat Agent
After=network.target

[Service]
Type=simple
User=root
Environment="DCM_BACKEND_URL=http://<YOUR_DCM_BACKEND_IP>:8000"
Environment="INTERVAL_SECONDS=60"
ExecStart=/usr/bin/python3 /path/to/agents/heartbeat_agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dcm-heartbeat
sudo systemctl start dcm-heartbeat
```

### **Stopping the Python systemd service**
```bash
sudo systemctl stop dcm-heartbeat
```
