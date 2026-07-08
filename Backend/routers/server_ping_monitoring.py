import logging
import asyncio
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import StreamingResponse
import io
import csv
from pydantic import BaseModel, Field
from bson import ObjectId
from database import db
from auth_utils import get_current_user, require_privilege

router = APIRouter()
logger = logging.getLogger("server_ping_monitoring")

# ----------------------------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------------------------
class MonitoredServerCreate(BaseModel):
    name: str = Field(..., min_length=1)
    ipAddress: str = Field(..., min_length=1)
    adminName: Optional[str] = Field(None)
    monitoringType: str = Field("heartbeat", pattern="^(ping|port|both|heartbeat)$")
    interval: int = Field(60, ge=10) # default 60s, min 10s
    timeout: int = Field(5, ge=1, le=10) # default 5s
    retryCount: int = Field(3, ge=1, le=10) # default 3 retries
    ports: List[int] = Field(default_factory=list)
    isEnabled: bool = Field(True)

class MonitoredServerUpdate(BaseModel):
    name: Optional[str] = None
    ipAddress: Optional[str] = None
    adminName: Optional[str] = None
    monitoringType: Optional[str] = Field(None, pattern="^(ping|port|both|heartbeat)$")
    interval: Optional[int] = Field(None, ge=10)
    timeout: Optional[int] = Field(None, ge=1, le=10)
    retryCount: Optional[int] = Field(None, ge=1, le=10)
    ports: Optional[List[int]] = None
    isEnabled: Optional[bool] = None

class NotificationChannelUpdate(BaseModel):
    isEnabled: bool
    config: Dict[str, Any]

# Helper to convert MongoDB object IDs to strings
def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    doc["id"] = str(doc.get("_id"))
    if "_id" in doc:
        del doc["_id"]
    return doc

def clean_ip_address(ip: str) -> str:
    cleaned = ip.strip()
    if "://" in cleaned:
        cleaned = cleaned.split("://", 1)[1]
    if "/" in cleaned:
        cleaned = cleaned.split("/", 1)[0]
    if ":" in cleaned:
        parts = cleaned.rsplit(":", 1)
        if parts[-1].isdigit():
            cleaned = parts[0]
            if cleaned.startswith("[") and cleaned.endswith("]"):
                cleaned = cleaned[1:-1]
    return cleaned.strip()

# ----------------------------------------------------------------------
# Async Check Executors (Agentless & Lightweight)
# ----------------------------------------------------------------------
async def exec_ping(ip: str, timeout: int) -> tuple[bool, float]:
    """Asynchronous ping check using asyncio subprocess. Returns (success, duration_ms)"""
    start_time = time.perf_counter()
    try:
        # -c 1: send 1 packet
        # -W timeout: timeout in seconds
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(timeout), ip,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()
        duration = (time.perf_counter() - start_time) * 1000.0
        return proc.returncode == 0, round(duration, 1)
    except Exception as e:
        logger.debug(f"Ping execution error for {ip}: {e}")
        duration = (time.perf_counter() - start_time) * 1000.0
        return False, round(duration, 1)

async def exec_tcp_port(ip: str, port: int, timeout: int) -> tuple[bool, float]:
    """Asynchronous TCP socket check. Returns (success, duration_ms)"""
    start_time = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=float(timeout)
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        duration = (time.perf_counter() - start_time) * 1000.0
        return True, round(duration, 1)
    except Exception as e:
        logger.debug(f"TCP check error for {ip}:{port} : {e}")
        duration = (time.perf_counter() - start_time) * 1000.0
        return False, round(duration, 1)

# ----------------------------------------------------------------------
# Background Monitoring Scheduler & Engine
# ----------------------------------------------------------------------
class ServerPingScheduler:
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._semaphore = asyncio.Semaphore(200) # Limit concurrent checks to 200
        self._last_checked: Dict[str, float] = {}

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Server Ping Monitoring Scheduler started.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Server Ping Monitoring Scheduler stopped.")

    async def _run_loop(self):
        while self._running:
            try:
                now = time.time()
                servers_col = db.get_collection("monitored_servers")
                # Fetch all enabled monitored servers
                cursor = servers_col.find({"isEnabled": True})
                async for server in cursor:
                    server_id = str(server["_id"])
                    interval = server.get("interval", 60)
                    last_check = self._last_checked.get(server_id, 0.0)

                    if now - last_check >= interval:
                        self._last_checked[server_id] = now
                        # Spawn non-blocking check task
                        asyncio.create_task(self._check_server_throttled(server))
            except Exception as e:
                logger.error(f"Error in Server Ping Monitoring Loop: {e}")
            await asyncio.sleep(1.0)

    async def _check_server_throttled(self, server: dict):
        async with self._semaphore:
            try:
                await self._check_server(server)
            except Exception as e:
                logger.error(f"Failed monitoring check for {server.get('ipAddress')}: {e}")

    async def _check_server(self, server: dict):
        server_id = str(server["_id"])
        ip = server["ipAddress"]
        name = server["name"]
        mon_type = server.get("monitoringType", "ping")
        timeout = server.get("timeout", 5)
        retry_count = server.get("retryCount", 3)
        ports = server.get("ports", [])

        # Fetch current status from DB or initialize
        status_col = db.get_collection("monitoring_status")
        curr_status = await status_col.find_one({"serverId": server_id})
        if not curr_status:
            curr_status = {
                "serverId": server_id,
                "name": name,
                "ipAddress": ip,
                "adminName": server.get("adminName", ""),
                "status": "UP",
                "previousStatus": "UP",
                "pingStatus": "UP",
                "portsStatus": {},
                "lastSuccessTime": None,
                "lastFailedTime": None,
                "consecutiveSuccess": 0,
                "consecutiveFailure": 0,
                "responseTimeMs": 0.0,
                "availabilityPct": 100.0,
                "totalChecks": 0,
                "totalSuccessChecks": 0,
                "lastOutageDuration": 0.0,
                "outagesCount": 0,
                "lastHeartbeatTime": time.time(),
                "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }

        # Perform check loop with retries
        success = False
        ping_ok = True
        ports_ok = True
        final_responseTime = 0.0
        ports_status_map = {}
        clean_ip = clean_ip_address(ip)

        # Run checks up to retry_count times sequentially if they fail
        for attempt in range(retry_count):
            curr_ping_ok = True
            curr_ports_ok = True
            durations = []

            # 1. ICMP Ping check
            if mon_type in ("ping", "both"):
                curr_ping_ok, p_dur = await exec_ping(clean_ip, timeout)
                durations.append(p_dur)

            # 2. TCP Port checks
            if mon_type in ("port", "both") and ports:
                port_failures = 0
                for port in ports:
                    pt_ok, pt_dur = await exec_tcp_port(clean_ip, port, timeout)
                    ports_status_map[str(port)] = "UP" if pt_ok else "DOWN"
                    durations.append(pt_dur)
                    if not pt_ok:
                        port_failures += 1
                
                if ports and port_failures == len(ports):
                    curr_ports_ok = False
            
            # 3. Heartbeat checks
            if mon_type == "heartbeat":
                last_hb = curr_status.get("lastHeartbeatTime", 0.0)
                grace_period = 15 # 15s grace
                if time.time() - last_hb <= server.get("interval", 60) + grace_period:
                    curr_ping_ok = True
                    curr_ports_ok = True
                else:
                    curr_ping_ok = False
                    curr_ports_ok = False
            
            # Combine based on type
            if mon_type == "both":
                attempt_ok = curr_ping_ok or curr_ports_ok
            elif mon_type in ("ping", "heartbeat"):
                attempt_ok = curr_ping_ok
            else:
                attempt_ok = curr_ports_ok

            if attempt_ok:
                success = True
                ping_ok = curr_ping_ok
                ports_ok = curr_ports_ok
                final_responseTime = sum(durations) / len(durations) if durations else 0.0
                break
            else:
                ping_ok = curr_ping_ok
                ports_ok = curr_ports_ok
                if attempt < retry_count - 1:
                    await asyncio.sleep(0.2) # short gap before retry

        # Determine target state
        if mon_type in ("both", "heartbeat"):
            target_status = "UP" if (ping_ok or ports_ok) else "DOWN"
        elif mon_type == "ping":
            target_status = "UP" if ping_ok else "DOWN"
        else: # port only
            target_status = "UP" if ports_ok else "DOWN"

        # Update stats
        total_checks = curr_status.get("totalChecks", 0) + 1
        total_success = curr_status.get("totalSuccessChecks", 0) + (1 if target_status == "UP" else 0)
        availability = round((total_success / total_checks) * 100.0, 2)

        prev_state = curr_status.get("status", "UNKNOWN")
        consec_success = curr_status.get("consecutiveSuccess", 0)
        consec_failure = curr_status.get("consecutiveFailure", 0)
        outages_count = curr_status.get("outagesCount", 0)
        last_outage_dur = curr_status.get("lastOutageDuration", 0.0)
        last_failed_time = curr_status.get("lastFailedTime")
        last_success_time = curr_status.get("lastSuccessTime")

        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        if target_status == "UP":
            consec_success += 1
            consec_failure = 0
            last_success_time = now_str
            # Calculate resolved outage duration
            if prev_state == "DOWN" and last_failed_time:
                try:
                    failed_dt = datetime.fromisoformat(last_failed_time.replace("Z", "+00:00"))
                    now_dt = datetime.now(timezone.utc)
                    last_outage_dur = round((now_dt - failed_dt).total_seconds(), 1)
                except Exception:
                    pass
        else: # DOWN
            if prev_state != "DOWN":
                outages_count += 1
                last_failed_time = now_str  # Only record the initial drop time
            consec_success = 0
            consec_failure += 1

        # State transition alert trigger
        state_changed = (prev_state != target_status) and (prev_state != "UNKNOWN")
        
        # Save updated status
        updated_status = {
            "serverId": server_id,
            "name": name,
            "ipAddress": ip,
            "status": target_status,
            "previousStatus": prev_state,
            "pingStatus": "UP" if ping_ok else "DOWN",
            "portsStatus": ports_status_map,
            "lastSuccessTime": last_success_time,
            "lastFailedTime": last_failed_time,
            "consecutiveSuccess": consec_success,
            "consecutiveFailure": consec_failure,
            "responseTimeMs": round(final_responseTime, 1),
            "availabilityPct": availability,
            "totalChecks": total_checks,
            "totalSuccessChecks": total_success,
            "lastOutageDuration": last_outage_dur,
            "outagesCount": outages_count,
            "lastUpdated": now_str
        }

        await status_col.update_one(
            {"serverId": server_id},
            {"$set": updated_status},
            upsert=True
        )

        # Log individual port failure transitions and trigger alarms/incidents
        prev_ports_status = curr_status.get("portsStatus", {})
        if mon_type in ("port", "both"):
            for p, curr_p_status in ports_status_map.items():
                prev_p_status = prev_ports_status.get(p, "UP")
                if curr_p_status != prev_p_status:
                    if curr_p_status == "DOWN":
                        # Log port failure
                        logs_col = db.get_collection("ping_drop_logs")
                        log_doc = {
                            "serverId": server_id,
                            "name": name,
                            "ipAddress": ip,
                            "adminName": server.get("adminName", ""),
                            "timestamp": now_str,
                            "pingStatus": "UP" if ping_ok else "DOWN",
                            "portsStatus": ports_status_map,
                            "reason": f"Port {p} check failed (Offline)"
                        }
                        await logs_col.insert_one(log_doc)

                        # Trigger incident alert
                        alert_msg = f"Server {name} ({ip}) Port {p} check failed (Offline)"
                        alert_history_col = db.get_collection("alert_history")
                        alert_doc = {
                            "serverId": server_id,
                            "name": name,
                            "ipAddress": ip,
                            "transition": f"PORT_{p}_DOWN",
                            "fromStatus": "UP",
                            "toStatus": "DOWN",
                            "message": alert_msg,
                            "timestamp": now_str,
                            "isAcknowledged": False,
                            "acknowledgedBy": None,
                            "acknowledgedAt": None,
                            "resolvedAt": None
                        }
                        await alert_history_col.insert_one(alert_doc)
                        await self._dispatch_notifications(name, ip, "UP", "DOWN", alert_msg)
                    elif curr_p_status == "UP":
                        # Port recovered
                        alert_msg = f"Server {name} ({ip}) Port {p} recovered (Online)"
                        alert_history_col = db.get_collection("alert_history")
                        alert_doc = {
                            "serverId": server_id,
                            "name": name,
                            "ipAddress": ip,
                            "transition": f"PORT_{p}_UP",
                            "fromStatus": "DOWN",
                            "toStatus": "UP",
                            "message": alert_msg,
                            "timestamp": now_str,
                            "isAcknowledged": False,
                            "acknowledgedBy": None,
                            "acknowledgedAt": None,
                            "resolvedAt": now_str
                        }
                        await alert_history_col.insert_one(alert_doc)
                        await self._dispatch_notifications(name, ip, "DOWN", "UP", alert_msg)

        # Log drop details to database if DOWN
        if target_status == "DOWN" and prev_state != "DOWN":
            logs_col = db.get_collection("ping_drop_logs")
            reason = "Ping failed" if not ping_ok else "Ports check failed"
            if mon_type == "both" and not ping_ok and not ports_ok:
                reason = "Ping and ports check failed"
            elif mon_type == "both" and ping_ok and not ports_ok:
                reason = "Ports check failed"
            
            failed_ports = [p for p, st in ports_status_map.items() if st == "DOWN"]
            if failed_ports:
                reason += f" (Offline ports: {', '.join(failed_ports)})"

            log_doc = {
                "serverId": server_id,
                "name": name,
                "ipAddress": ip,
                "adminName": server.get("adminName", ""),
                "timestamp": now_str,
                "pingStatus": "UP" if ping_ok else "DOWN",
                "portsStatus": ports_status_map,
                "reason": reason
            }
            await logs_col.insert_one(log_doc)

        if state_changed:
            # Trigger alert and write logs
            alert_msg = f"Server status transitioned from {prev_state} to {target_status}."
            if mon_type in ("port", "both"):
                failed_ports = [p for p, st in ports_status_map.items() if st == "DOWN"]
                if failed_ports:
                    alert_msg += f" Offline ports: {', '.join(failed_ports)}"

            alert_history_col = db.get_collection("alert_history")
            alert_doc = {
                "serverId": server_id,
                "name": name,
                "ipAddress": ip,
                "transition": f"{prev_state}_TO_{target_status}",
                "fromStatus": prev_state,
                "toStatus": target_status,
                "message": alert_msg,
                "timestamp": now_str,
                "isAcknowledged": False,
                "acknowledgedBy": None,
                "acknowledgedAt": None,
                "resolvedAt": now_str if target_status == "UP" else None
            }
            await alert_history_col.insert_one(alert_doc)

            # Trigger Dispatch notifications
            await self._dispatch_notifications(name, ip, prev_state, target_status, alert_msg)

    async def _dispatch_notifications(self, name: str, ip: str, from_st: str, to_st: str, msg: str):
        # Fetch enabled channels
        channels_col = db.get_collection("notification_channels")
        cursor = channels_col.find({"isEnabled": True})
        async for ch in cursor:
            ch_type = ch.get("type")
            config = ch.get("config", {})
            try:
                if ch_type == "telegram":
                    await self._send_telegram(config, name, ip, from_st, to_st, msg)
                elif ch_type == "email":
                    await self._send_email(config, name, ip, from_st, to_st, msg)
                elif ch_type == "webhook":
                    await self._send_webhook(config, name, ip, from_st, to_st, msg)
            except Exception as e:
                logger.error(f"Failed to dispatch {ch_type} notification: {e}")

    async def _send_telegram(self, config: dict, name: str, ip: str, from_st: str, to_st: str, msg: str):
        bot_token = config.get("botToken")
        chat_id = config.get("chatId")
        if not bot_token or not chat_id:
            return
        text = f"🚨 *SERVER MONITORING ALERT* 🚨\n*Server*: {name} ({ip})\n*Transition*: {from_st} ➡️ {to_st}\n*Details*: {msg}"
        # Lightweight async HTTP post using urllib/asyncio run_in_executor
        import urllib.request
        import urllib.parse
        import json
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        
        def do_post():
            req = urllib.request.Request(url, method="POST", data=json.dumps(payload).encode())
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                resp.read()
        
        await asyncio.get_event_loop().run_in_executor(None, do_post)

    async def _send_email(self, config: dict, name: str, ip: str, from_st: str, to_st: str, msg: str):
        recipient = config.get("recipientEmail")
        if not recipient:
            return
        
        smtp_host = config.get("smtpHost", "smtp.gmail.com")
        smtp_port = int(config.get("smtpPort", 587))
        smtp_user = config.get("smtpUser", "")
        smtp_pass = config.get("smtpPassword", "")
        sender_email = config.get("senderEmail", smtp_user or "alerts@dcm.local")

        logger.info(f"[Email Alert] Sending to {recipient}: Server {name} ({ip}) changed from {from_st} to {to_st}. Message: {msg}")

        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        def do_send():
            message = MIMEMultipart()
            message["From"] = sender_email
            message["To"] = recipient
            message["Subject"] = f"🚨 DCM ALERT: Server {name} is {to_st} 🚨"
            
            body = f"Server Name: {name}\nIP Address: {ip}\nStatus Change: {from_st} -> {to_st}\nDetails: {msg}\n\nPlease check the DCM dashboard for more details."
            message.attach(MIMEText(body, "plain"))

            try:
                # Use context manager for SMTP connection
                if smtp_port in (465,):
                    with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                        if smtp_user and smtp_pass:
                            server.login(smtp_user, smtp_pass)
                        server.send_message(message)
                else:
                    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                        server.ehlo()
                        if smtp_port == 587:
                            server.starttls()
                            server.ehlo()
                        if smtp_user and smtp_pass:
                            server.login(smtp_user, smtp_pass)
                        server.send_message(message)
                logger.info(f"Email sent successfully to {recipient}")
            except Exception as e:
                logger.error(f"Failed to send email to {recipient}: {e}")

        await asyncio.get_event_loop().run_in_executor(None, do_send)

    async def _send_webhook(self, config: dict, name: str, ip: str, from_st: str, to_st: str, msg: str):
        webhook_url = config.get("webhookUrl")
        if not webhook_url:
            return
        import urllib.request
        import json
        payload = {
            "event": "server_status_changed",
            "serverName": name,
            "ipAddress": ip,
            "fromStatus": from_st,
            "toStatus": to_st,
            "message": msg,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        def do_post():
            req = urllib.request.Request(webhook_url, method="POST", data=json.dumps(payload).encode())
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                resp.read()

        await asyncio.get_event_loop().run_in_executor(None, do_post)

# Global Background Scheduler instance
server_ping_scheduler = ServerPingScheduler()


# ----------------------------------------------------------------------
# API Endpoints
# ----------------------------------------------------------------------

class HeartbeatPayload(BaseModel):
    ipAddress: str
    hostname: Optional[str] = None
    status: str = "UP"

@router.post("/heartbeat", response_description="Receive a heartbeat from a server agent")
async def receive_heartbeat(payload: HeartbeatPayload):
    servers_col = db.get_collection("monitored_servers")
    server = await servers_col.find_one({"ipAddress": payload.ipAddress, "isEnabled": True})
    
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    if not server:
        # Auto-register the server if it doesn't exist
        server_doc = {
            "name": payload.hostname or payload.ipAddress,
            "ipAddress": payload.ipAddress,
            "adminName": "Agent Auto-Registered",
            "monitoringType": "heartbeat",
            "interval": 60,
            "timeout": 5,
            "retryCount": 3,
            "ports": [],
            "isEnabled": True,
            "createdBy": "agent",
            "createdAt": now_str,
            "updatedAt": now_str
        }
        res = await servers_col.insert_one(server_doc)
        server_id = str(res.inserted_id)
        name = server_doc["name"]
    else:
        server_id = str(server["_id"])
        name = server["name"]

    status_col = db.get_collection("monitoring_status")
    
    # Update last heartbeat time
    await status_col.update_one(
        {"serverId": server_id},
        {"$set": {
            "lastHeartbeatTime": time.time(),
            "name": name,
            "ipAddress": payload.ipAddress
        }},
        upsert=True
    )
    return {"status": "ok", "message": "Heartbeat received"}

# 1. Monitored Server CRUD
@router.post("/", response_description="Register a new monitored server", status_code=status.HTTP_201_CREATED)
async def create_monitored_server(
    data: MonitoredServerCreate,
    current_user: dict = Depends(require_privilege("Create Server Ping Monitoring"))
):
    servers_col = db.get_collection("monitored_servers")
    
    # Check if IP already monitored
    existing = await servers_col.find_one({"ipAddress": data.ipAddress})
    if existing:
        raise HTTPException(status_code=400, detail="Server with this IP address is already registered for monitoring.")

    server_doc = {
        "name": data.name,
        "ipAddress": data.ipAddress,
        "adminName": data.adminName,
        "monitoringType": data.monitoringType,
        "interval": data.interval,
        "timeout": data.timeout,
        "retryCount": data.retryCount,
        "ports": data.ports,
        "isEnabled": data.isEnabled,
        "createdBy": current_user.get("username", "admin"),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }

    result = await servers_col.insert_one(server_doc)
    server_doc["id"] = str(result.inserted_id)
    del server_doc["_id"]

    # Trigger immediate status initialization
    status_col = db.get_collection("monitoring_status")
    await status_col.update_one(
        {"serverId": server_doc["id"]},
        {"$set": {
            "serverId": server_doc["id"],
            "name": data.name,
            "ipAddress": data.ipAddress,
            "adminName": data.adminName or "",
            "status": "UP",
            "previousStatus": "UP",
            "pingStatus": "UP",
            "portsStatus": {},
            "lastSuccessTime": None,
            "lastFailedTime": None,
            "consecutiveSuccess": 0,
            "consecutiveFailure": 0,
            "responseTimeMs": 0.0,
            "availabilityPct": 100.0,
            "totalChecks": 0,
            "totalSuccessChecks": 0,
            "lastOutageDuration": 0.0,
            "outagesCount": 0,
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }},
        upsert=True
    )

    return server_doc

@router.get("/", response_description="List monitored servers")
async def list_monitored_servers(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    sortBy: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    servers_col = db.get_collection("monitored_servers")
    status_col = db.get_collection("monitoring_status")

    # Match servers by search term
    server_query = {}
    if search:
        escaped_search = search.strip().replace('\\', '\\\\')
        server_query["$or"] = [
            {"name": {"$regex": escaped_search, "$options": "i"}},
            {"ipAddress": {"$regex": escaped_search, "$options": "i"}},
            {"adminName": {"$regex": escaped_search, "$options": "i"}}
        ]

    # Retrieve all matched server profiles
    servers = await servers_col.find(server_query).to_list(length=None)
    server_ids = [str(s["_id"]) for s in servers]

    # Query matching statuses
    status_query: Dict[str, Any] = {"serverId": {"$in": server_ids}}
    if status_filter:
        status_query["status"] = status_filter

    # Sort & pagination on status collection
    sort_field = sortBy or "lastUpdated"
    sort_dir = 1 if order == "asc" else -1

    total = await status_col.count_documents(status_query)
    cursor = status_col.find(status_query).sort([("status", 1), (sort_field, sort_dir)]).skip(skip).limit(limit)
    status_list = await cursor.to_list(length=limit)

    # Hydrate configuration details into status representation
    servers_map = {str(s["_id"]): s for s in servers}
    hydrated = []
    for st in status_list:
        cfg = servers_map.get(st["serverId"], {})
        item = serialize_doc(st)
        item["id"] = st["serverId"] # Map to server config ID instead of status ID
        item["isEnabled"] = cfg.get("isEnabled", True)
        item["adminName"] = cfg.get("adminName", "")
        item["interval"] = cfg.get("interval", 60)
        item["timeout"] = cfg.get("timeout", 5)
        item["retryCount"] = cfg.get("retryCount", 3)
        item["ports"] = cfg.get("ports", [])
        item["monitoringType"] = cfg.get("monitoringType", "ping")
        hydrated.append(item)

    return {"data": hydrated, "total": total}

@router.put("/{id}", response_description="Update monitored server configuration")
async def update_monitored_server(
    id: str,
    data: MonitoredServerUpdate,
    current_user: dict = Depends(require_privilege("Update Server Ping Monitoring"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    servers_col = db.get_collection("monitored_servers")
    server = await servers_col.find_one({"_id": ObjectId(id)})
    if not server:
        raise HTTPException(status_code=404, detail="Monitored server not found")

    update_fields = {}
    data_dict = data.dict(exclude_unset=True)
    for k, v in data_dict.items():
        update_fields[k] = v

    if update_fields:
        update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        await servers_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})

        # Update monitoring_status identifiers
        status_update = {}
        if "name" in update_fields:
            status_update["name"] = update_fields["name"]
        if "ipAddress" in update_fields:
            status_update["ipAddress"] = update_fields["ipAddress"]
        if "adminName" in update_fields:
            status_update["adminName"] = update_fields["adminName"] or ""
        if status_update:
            status_col = db.get_collection("monitoring_status")
            await status_col.update_one({"serverId": id}, {"$set": status_update})

    # Return refreshed configuration
    refreshed = await servers_col.find_one({"_id": ObjectId(id)})
    return serialize_doc(refreshed)

@router.delete("/{id}", response_description="Delete monitored server")
async def delete_monitored_server(
    id: str,
    current_user: dict = Depends(require_privilege("Delete Server Ping Monitoring"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    servers_col = db.get_collection("monitored_servers")
    status_col = db.get_collection("monitoring_status")
    alert_history_col = db.get_collection("alert_history")

    res = await servers_col.delete_one({"_id": ObjectId(id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Monitored server not found")

    await status_col.delete_many({"serverId": id})
    await alert_history_col.delete_many({"serverId": id})

    return {"detail": "Server monitoring registered config and history deleted successfully"}

# 2. Dashboard Telemetry Statistics
@router.get("/dashboard", response_description="Get Server Ping Monitoring Dashboard")
async def get_dashboard(
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    status_col = db.get_collection("monitoring_status")
    servers_col = db.get_collection("monitored_servers")

    # Get list of existing server IDs to prevent counting orphaned records
    servers = await servers_col.find({}).to_list(length=None)
    server_ids = [str(s["_id"]) for s in servers]

    # Counts by status, scoped to existing servers
    total = len(server_ids)
    online = await status_col.count_documents({"serverId": {"$in": server_ids}, "status": "UP"})
    offline = await status_col.count_documents({"serverId": {"$in": server_ids}, "status": "DOWN"})

    return {
        "metrics": {
            "total": total,
            "online": online,
            "offline": offline,
            "degraded": 0,
            "unknown": 0,
        },
        "activeIncidents": [],
        "recentRecoveries": []
    }

# 3. Active Incident List and Acknowledgment
@router.get("/incidents", response_description="Get unacknowledged server incidents")
async def get_active_incidents(
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    alert_history_col = db.get_collection("alert_history")
    incidents = await alert_history_col.find({
        "isAcknowledged": False,
        "toStatus": {"$in": ["DOWN", "DEGRADED"]}
    }).sort("timestamp", -1).to_list(length=None)

    return [serialize_doc(i) for i in incidents]

@router.post("/incidents/{id}/acknowledge", response_description="Acknowledge an active incident alert")
async def acknowledge_incident(
    id: str,
    current_user: dict = Depends(require_privilege("Update Server Ping Monitoring"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    alert_history_col = db.get_collection("alert_history")
    alert = await alert_history_col.find_one({"_id": ObjectId(id)})
    if not alert:
        raise HTTPException(status_code=404, detail="Incident alert history record not found")

    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    await alert_history_col.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "isAcknowledged": True,
            "acknowledgedBy": current_user.get("username", "admin"),
            "acknowledgedAt": now_str
        }}
    )

    return {"detail": "Incident alert acknowledged successfully"}

# 4. Notification Channels Configuration
@router.get("/channels", response_description="List configured notification channels")
async def list_notification_channels(
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    channels_col = db.get_collection("notification_channels")
    
    # Initialize default channels if collection is empty
    count = await channels_col.count_documents({})
    if count == 0:
        default_channels = [
            {"type": "telegram", "config": {"botToken": "", "chatId": ""}, "isEnabled": False},
            {"type": "email", "config": {"recipientEmail": ""}, "isEnabled": False},
            {"type": "webhook", "config": {"webhookUrl": ""}, "isEnabled": False},
        ]
        await channels_col.insert_many(default_channels)

    cursor = channels_col.find({})
    channels = await cursor.to_list(length=None)
    return [serialize_doc(c) for c in channels]

@router.put("/channels/{id}", response_description="Update notification channel details")
async def update_notification_channel(
    id: str,
    data: NotificationChannelUpdate,
    current_user: dict = Depends(require_privilege("Update Server Ping Monitoring"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    channels_col = db.get_collection("notification_channels")
    channel = await channels_col.find_one({"_id": ObjectId(id)})
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    await channels_col.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "isEnabled": data.isEnabled,
            "config": data.config
        }}
    )

    refreshed = await channels_col.find_one({"_id": ObjectId(id)})
    return serialize_doc(refreshed)

# 5. Ping Drop Event Logs & CSV Export
@router.get("/logs", response_description="Get ping drop logs")
async def get_ping_drop_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    start_date: Optional[str] = Query(None), # YYYY-MM-DD
    end_date: Optional[str] = Query(None), # YYYY-MM-DD
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    logs_col = db.get_collection("ping_drop_logs")
    query = {}
    
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            # Match from the start of the start_date
            query["timestamp"]["$gte"] = f"{start_date}T00:00:00"
        if end_date:
            # Match to the end of the end_date
            query["timestamp"]["$lte"] = f"{end_date}T23:59:59Z"
            
    total = await logs_col.count_documents(query)
    cursor = logs_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    return {
        "data": [serialize_doc(l) for l in logs],
        "total": total
    }

@router.get("/logs/export", response_description="Export ping drop logs to CSV")
async def export_ping_drop_logs(
    start_date: Optional[str] = Query(None), # YYYY-MM-DD
    end_date: Optional[str] = Query(None), # YYYY-MM-DD
    current_user: dict = Depends(require_privilege("View Server Ping Monitoring"))
):
    logs_col = db.get_collection("ping_drop_logs")
    query = {}
    
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = f"{start_date}T00:00:00"
        if end_date:
            query["timestamp"]["$lte"] = f"{end_date}T23:59:59Z"
            
    cursor = logs_col.find(query).sort("timestamp", -1)
    logs = await cursor.to_list(length=10000)

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header columns
    writer.writerow([
        "Server Name", 
        "IP Address", 
        "Admin Name", 
        "Ping Dropped Time (UTC)", 
        "Ping Status", 
        "Ports Status Details", 
        "Failure Reason"
    ])
    
    for log in logs:
        ports_str = ", ".join(f"Port {p}: {s}" for p, s in log.get("portsStatus", {}).items())
        writer.writerow([
            log.get("name", ""),
            log.get("ipAddress", ""),
            log.get("adminName", ""),
            log.get("timestamp", ""),
            log.get("pingStatus", ""),
            ports_str,
            log.get("reason", "")
        ])
        
    output.seek(0)
    
    # We return standard StreamingResponse
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=server_ping_drops.csv"}
    )
