"""
Metrics Monitoring Router
─────────────────────────
CRUD for monitored applications and their targets (IPs/ports/exporters).
Live scraping of Prometheus endpoints (Node Exporter, DCGM Exporter, vLLM/Triton).
Ping & port-check support per target.
"""
import logging
import asyncio
import re
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId
from pymongo import ReturnDocument
from database import db, get_local_now
from auth_utils import get_current_user, require_any_privilege

router = APIRouter()
logger = logging.getLogger("metrics_monitoring")

# ──────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────

class TargetCreate(BaseModel):
    ip: str = Field(..., min_length=1)
    port: int = Field(9100)
    exporterType: str = Field("node_exporter", pattern="^(node_exporter|dcgm_exporter|custom)$")
    monitoringTypes: List[str] = Field(default_factory=lambda: ["ping", "port", "metrics"])
    label: Optional[str] = Field(None)

    @field_validator('ip')
    @classmethod
    def validate_ip(cls, v: str) -> str:
        import re as _re
        v = v.strip()
        if not _re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', v):
            # Allow hostnames too
            if not _re.match(r'^[a-zA-Z0-9._-]+$', v):
                raise ValueError("Must be a valid IPv4 address or hostname")
            return v
        for part in v.split('.'):
            if not (0 <= int(part) <= 255):
                raise ValueError("Must be a valid IPv4 address (octets 0-255)")
        return v

    @field_validator('port')
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator('monitoringTypes')
    @classmethod
    def validate_monitoring_types(cls, v: List[str]) -> List[str]:
        allowed = {"ping", "port", "metrics"}
        for mt in v:
            if mt not in allowed:
                raise ValueError(f"Invalid monitoring type '{mt}'. Allowed: {allowed}")
        if not v:
            raise ValueError("At least one monitoring type is required")
        return v


class TargetUpdate(BaseModel):
    ip: Optional[str] = None
    port: Optional[int] = None
    exporterType: Optional[str] = Field(None, pattern="^(node_exporter|dcgm_exporter|custom)$")
    monitoringTypes: Optional[List[str]] = None
    label: Optional[str] = None

    @field_validator('ip')
    @classmethod
    def validate_ip(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            import re as _re
            v = v.strip()
            if not _re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', v):
                if not _re.match(r'^[a-zA-Z0-9._-]+$', v):
                    raise ValueError("Must be a valid IPv4 address or hostname")
                return v
            for part in v.split('.'):
                if not (0 <= int(part) <= 255):
                    raise ValueError("Must be a valid IPv4 address (octets 0-255)")
        return v

    @field_validator('port')
    @classmethod
    def validate_port(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator('monitoringTypes')
    @classmethod
    def validate_monitoring_types(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            allowed = {"ping", "port", "metrics"}
            for mt in v:
                if mt not in allowed:
                    raise ValueError(f"Invalid monitoring type '{mt}'. Allowed: {allowed}")
            if not v:
                raise ValueError("At least one monitoring type is required")
        return v


class ApplicationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    targets: List[TargetCreate] = Field(default_factory=list)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r'^[a-zA-Z0-9\s._-]+$', v):
            raise ValueError("Name must be alphanumeric with spaces, dashes, dots or underscores only")
        return v


class ApplicationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not re.match(r'^[a-zA-Z0-9\s._-]+$', v):
                raise ValueError("Name must be alphanumeric with spaces, dashes, dots or underscores only")
        return v


# ──────────────────────────────────────────────
# Helpers — Prometheus text format parser
# ──────────────────────────────────────────────

def parse_prometheus_text(text: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parse Prometheus exposition format into a dict of metric_name -> list of {labels, value}.
    """
    metrics: Dict[str, List[Dict[str, Any]]] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # Parse: metric_name{label="val",...} value
        # Or:   metric_name value
        match = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)\{(.+?)\}\s+(.+)$', line)
        if match:
            name = match.group(1)
            labels_str = match.group(2)
            value_str = match.group(3).split()[0]  # ignore timestamp
            labels = {}
            for lbl in re.findall(r'(\w+)="([^"]*)"', labels_str):
                labels[lbl[0]] = lbl[1]
            try:
                value = float(value_str)
            except ValueError:
                continue
            metrics.setdefault(name, []).append({"labels": labels, "value": value})
        else:
            match2 = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(.+)$', line)
            if match2:
                name = match2.group(1)
                value_str = match2.group(2).split()[0]
                try:
                    value = float(value_str)
                except ValueError:
                    continue
                metrics.setdefault(name, []).append({"labels": {}, "value": value})
    return metrics


def extract_node_exporter_metrics(raw: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Extract human-friendly system metrics from Node Exporter raw data."""
    result: Dict[str, Any] = {}

    # ── CPU Usage ──
    cpu_entries = raw.get("node_cpu_seconds_total", [])
    idle_total = 0.0
    all_total = 0.0
    for entry in cpu_entries:
        all_total += entry["value"]
        if entry["labels"].get("mode") == "idle":
            idle_total += entry["value"]
    if all_total > 0:
        result["cpuUsagePercent"] = round((1 - idle_total / all_total) * 100, 2)
    else:
        result["cpuUsagePercent"] = None

    # ── CPU count ──
    cpu_count_entries = raw.get("node_cpu_seconds_total", [])
    cpus = set()
    for entry in cpu_count_entries:
        cpu_id = entry["labels"].get("cpu")
        if cpu_id is not None:
            cpus.add(cpu_id)
    result["cpuCount"] = len(cpus) if cpus else None

    # ── RAM ──
    mem_total_entries = raw.get("node_memory_MemTotal_bytes", [])
    mem_avail_entries = raw.get("node_memory_MemAvailable_bytes", [])
    mem_total = mem_total_entries[0]["value"] if mem_total_entries else None
    mem_avail = mem_avail_entries[0]["value"] if mem_avail_entries else None
    if mem_total and mem_avail:
        mem_used = mem_total - mem_avail
        result["ramTotalBytes"] = mem_total
        result["ramUsedBytes"] = mem_used
        result["ramAvailableBytes"] = mem_avail
        result["ramUsagePercent"] = round((mem_used / mem_total) * 100, 2)
    else:
        result["ramTotalBytes"] = mem_total
        result["ramUsedBytes"] = None
        result["ramAvailableBytes"] = mem_avail
        result["ramUsagePercent"] = None

    # ── Disk ──
    fs_size = raw.get("node_filesystem_size_bytes", [])
    fs_avail = raw.get("node_filesystem_avail_bytes", [])
    disks = []
    avail_map = {}
    for entry in fs_avail:
        mount = entry["labels"].get("mountpoint", "")
        fstype = entry["labels"].get("fstype", "")
        if fstype in ("tmpfs", "devtmpfs", "squashfs", "overlay", "nsfs"):
            continue
        avail_map[mount] = entry["value"]
    for entry in fs_size:
        mount = entry["labels"].get("mountpoint", "")
        fstype = entry["labels"].get("fstype", "")
        if fstype in ("tmpfs", "devtmpfs", "squashfs", "overlay", "nsfs"):
            continue
        size = entry["value"]
        avail = avail_map.get(mount)
        if size and size > 0 and avail is not None:
            used = size - avail
            disks.append({
                "mountpoint": mount,
                "device": entry["labels"].get("device", ""),
                "totalBytes": size,
                "usedBytes": used,
                "availableBytes": avail,
                "usagePercent": round((used / size) * 100, 2),
            })
    result["disks"] = disks

    # ── Network throughput ──
    net_rx = raw.get("node_network_receive_bytes_total", [])
    net_tx = raw.get("node_network_transmit_bytes_total", [])
    networks = []
    for entry in net_rx:
        iface = entry["labels"].get("device", "")
        if iface in ("lo", ""):
            continue
        tx_val = 0
        for tx in net_tx:
            if tx["labels"].get("device") == iface:
                tx_val = tx["value"]
                break
        networks.append({
            "interface": iface,
            "rxBytes": entry["value"],
            "txBytes": tx_val,
        })
    result["networks"] = networks

    # ── Load average ──
    load1 = raw.get("node_load1", [])
    load5 = raw.get("node_load5", [])
    load15 = raw.get("node_load15", [])
    result["loadAverage"] = {
        "load1": round(load1[0]["value"], 2) if load1 else None,
        "load5": round(load5[0]["value"], 2) if load5 else None,
        "load15": round(load15[0]["value"], 2) if load15 else None,
    }

    # ── Uptime ──
    boot_time = raw.get("node_boot_time_seconds", [])
    if boot_time:
        uptime_sec = time.time() - boot_time[0]["value"]
        days = int(uptime_sec // 86400)
        hours = int((uptime_sec % 86400) // 3600)
        minutes = int((uptime_sec % 3600) // 60)
        result["uptimeSeconds"] = uptime_sec
        result["uptimeHuman"] = f"{days}d {hours}h {minutes}m"
    else:
        result["uptimeSeconds"] = None
        result["uptimeHuman"] = None

    return result


def extract_dcgm_metrics(raw: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Extract GPU metrics from DCGM Exporter raw data."""
    result: Dict[str, Any] = {"gpus": []}

    # Collect per-GPU data
    gpu_map: Dict[str, Dict[str, Any]] = {}

    def _set_gpu(entries, field_name, transform=None):
        for entry in entries:
            gpu_id = entry["labels"].get("gpu", entry["labels"].get("UUID", "0"))
            if gpu_id not in gpu_map:
                gpu_map[gpu_id] = {"gpuId": gpu_id, "gpuModel": entry["labels"].get("modelName", entry["labels"].get("device", ""))}
            val = entry["value"]
            if transform:
                val = transform(val)
            gpu_map[gpu_id][field_name] = val

    _set_gpu(raw.get("DCGM_FI_DEV_GPU_UTIL", []), "gpuUtilPercent", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_FB_USED", []), "fbUsedMB", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_FB_FREE", []), "fbFreeMB", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_GPU_TEMP", []), "temperatureC", lambda v: round(v, 1))
    _set_gpu(raw.get("DCGM_FI_DEV_POWER_USAGE", []), "powerWatts", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_SM_CLOCK", []), "smClockMHz", lambda v: round(v, 0))
    _set_gpu(raw.get("DCGM_FI_DEV_MEM_CLOCK", []), "memClockMHz", lambda v: round(v, 0))
    _set_gpu(raw.get("DCGM_FI_DEV_PCIE_TX_THROUGHPUT", []), "pcieTxKBps")
    _set_gpu(raw.get("DCGM_FI_DEV_PCIE_RX_THROUGHPUT", []), "pcieRxKBps")
    _set_gpu(raw.get("DCGM_FI_DEV_MEM_COPY_UTIL", []), "memCopyUtilPercent", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_ENC_UTIL", []), "encoderUtilPercent", lambda v: round(v, 2))
    _set_gpu(raw.get("DCGM_FI_DEV_DEC_UTIL", []), "decoderUtilPercent", lambda v: round(v, 2))

    # Compute total memory per GPU
    for gpu_id, data in gpu_map.items():
        fb_used = data.get("fbUsedMB", 0)
        fb_free = data.get("fbFreeMB", 0)
        fb_total = fb_used + fb_free
        data["fbTotalMB"] = round(fb_total, 2)
        if fb_total > 0:
            data["fbUsagePercent"] = round((fb_used / fb_total) * 100, 2)
        else:
            data["fbUsagePercent"] = None

    result["gpus"] = list(gpu_map.values())

    # ── Inference / vLLM / Triton metrics ──
    inference = {}

    # vLLM metrics
    kv_cache_entries = raw.get("vllm:kv_cache_usage_percent", [])
    if not kv_cache_entries:
        kv_cache_entries = raw.get("vllm_kv_cache_usage_percent", [])
    if kv_cache_entries:
        inference["kvCacheUsagePercent"] = round(kv_cache_entries[0]["value"] * 100, 2)

    running_reqs = raw.get("vllm:num_requests_running", [])
    if not running_reqs:
        running_reqs = raw.get("vllm_num_requests_running", [])
    if running_reqs:
        inference["numRequestsRunning"] = int(running_reqs[0]["value"])

    waiting_reqs = raw.get("vllm:num_requests_waiting", [])
    if not waiting_reqs:
        waiting_reqs = raw.get("vllm_num_requests_waiting", [])
    if waiting_reqs:
        inference["numRequestsWaiting"] = int(waiting_reqs[0]["value"])

    throughput = raw.get("vllm:avg_generation_throughput_toks_per_s", [])
    if not throughput:
        throughput = raw.get("vllm_avg_generation_throughput_toks_per_s", [])
    if throughput:
        inference["generationThroughputToksPerSec"] = round(throughput[0]["value"], 2)

    # Triton / NVIDIA Inference Server
    queue_entries = raw.get("nv_inference_queue_duration_us", [])
    if queue_entries:
        inference["inferenceQueueDurationUs"] = round(queue_entries[0]["value"], 2)

    nv_kv = raw.get("nv_gpu_kv_cache_usage", [])
    if nv_kv:
        inference["kvCacheUsagePercent"] = round(nv_kv[0]["value"] * 100, 2)

    gpu_cache_usage = raw.get("vllm:gpu_cache_usage_perc", [])
    if not gpu_cache_usage:
        gpu_cache_usage = raw.get("vllm_gpu_cache_usage_perc", [])
    if gpu_cache_usage:
        inference["gpuCacheUsagePercent"] = round(gpu_cache_usage[0]["value"] * 100, 2)

    result["inference"] = inference

    return result


# ──────────────────────────────────────────────
# Live Checks
# ──────────────────────────────────────────────

async def check_ping(ip: str, timeout: int = 2) -> Dict[str, Any]:
    """Ping a host and return status + latency."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", str(timeout), ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout + 2)
        output = stdout.decode()
        latency = None
        match = re.search(r'time[=<](\d+\.?\d*)', output)
        if match:
            latency = float(match.group(1))
        return {
            "status": "UP" if proc.returncode == 0 else "DOWN",
            "latencyMs": latency,
        }
    except Exception as e:
        logger.warning(f"Ping check failed for {ip}: {e}")
        return {"status": "DOWN", "latencyMs": None, "error": str(e)}


async def check_port(ip: str, port: int, timeout: int = 3) -> Dict[str, Any]:
    """Check if a TCP port is open."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=timeout
        )
        writer.close()
        await writer.wait_closed()
        return {"status": "UP", "port": port}
    except Exception as e:
        return {"status": "DOWN", "port": port, "error": str(e)}


async def scrape_metrics(ip: str, port: int, timeout: int = 5) -> Dict[str, Any]:
    """Scrape Prometheus /metrics endpoint."""
    import httpx
    url = f"http://{ip}:{port}/metrics"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw_text = resp.text
            parsed = parse_prometheus_text(raw_text)
            return {"status": "OK", "raw": parsed}
    except Exception as e:
        logger.warning(f"Metrics scrape failed for {url}: {e}")
        return {"status": "ERROR", "error": str(e), "raw": {}}


async def scrape_target(target: Dict[str, Any]) -> Dict[str, Any]:
    """Run all configured checks for a single target."""
    ip = target["ip"]
    port = target.get("port", 9100)
    exporter_type = target.get("exporterType", "node_exporter")
    monitoring_types = target.get("monitoringTypes", ["ping", "port", "metrics"])
    label = target.get("label", "")

    result: Dict[str, Any] = {
        "ip": ip,
        "port": port,
        "exporterType": exporter_type,
        "monitoringTypes": monitoring_types,
        "label": label,
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
    }

    tasks = []
    task_keys = []

    if "ping" in monitoring_types:
        tasks.append(check_ping(ip))
        task_keys.append("ping")

    if "port" in monitoring_types:
        tasks.append(check_port(ip, port))
        task_keys.append("port")

    if "metrics" in monitoring_types:
        tasks.append(scrape_metrics(ip, port))
        task_keys.append("metrics")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for key, res in zip(task_keys, results):
        if isinstance(res, Exception):
            result[key] = {"status": "ERROR", "error": str(res)}
        else:
            result[key] = res

    # Parse exporter-specific metrics
    metrics_data = result.get("metrics", {})
    if metrics_data.get("status") == "OK":
        raw = metrics_data.get("raw", {})
        if exporter_type == "node_exporter":
            result["nodeMetrics"] = extract_node_exporter_metrics(raw)
        elif exporter_type == "dcgm_exporter":
            result["dcgmMetrics"] = extract_dcgm_metrics(raw)
        elif exporter_type == "custom":
            # For custom, also try both parsers — return whichever has data
            node_m = extract_node_exporter_metrics(raw)
            dcgm_m = extract_dcgm_metrics(raw)
            if node_m.get("cpuUsagePercent") is not None:
                result["nodeMetrics"] = node_m
            if dcgm_m.get("gpus"):
                result["dcgmMetrics"] = dcgm_m

        # Remove raw to keep response size manageable
        if "raw" in result.get("metrics", {}):
            del result["metrics"]["raw"]

    # Compute overall status
    statuses = []
    if "ping" in result:
        statuses.append(result["ping"].get("status"))
    if "port" in result:
        statuses.append(result["port"].get("status"))
    if "metrics" in result:
        statuses.append("UP" if result["metrics"].get("status") == "OK" else "DOWN")
    result["overallStatus"] = "DOWN" if "DOWN" in statuses or "ERROR" in statuses else "UP"

    return result


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-serializable dict."""
    doc["id"] = str(doc.pop("_id"))
    return doc


# ──────────────────────────────────────────────
# CRUD — Applications
# ──────────────────────────────────────────────

@router.get("/", response_description="Get Metrics monitoring",
    dependencies=[Depends(require_any_privilege(["view_metrics_monitoring"]))])
async def list_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=100),
    current_user: dict = Depends(get_current_user),
):
    """List all monitored applications."""
    query: Dict[str, Any] = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    total = await db.metrics_applications.count_documents(query)
    cursor = db.metrics_applications.find(query).sort("name", 1).skip(skip).limit(limit)
    apps = []
    async for doc in cursor:
        apps.append(serialize_doc(doc))
    return {"data": apps, "total": total, "skip": skip, "limit": limit}


@router.post("/", status_code=status.HTTP_201_CREATED,response_description="Create a new monitored application",
    dependencies=[Depends(require_any_privilege(["create_update_metrics_monitoring"]))])
async def create_application(
    payload: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new monitored application."""
    # Check duplicate name
    existing = await db.metrics_applications.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Application with this name already exists")

    doc = {
        "name": payload.name,
        "description": payload.description or "",
        "targets": [t.model_dump() for t in payload.targets],
        "createdBy": current_user.get("username", ""),
        "createdAt": get_local_now().isoformat(),
        "updatedAt": get_local_now().isoformat(),
    }
    result = await db.metrics_applications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.get("/{app_id}",
    dependencies=[Depends(require_any_privilege(["view_metrics_monitoring"]))])
async def get_application(
    app_id: str,
):
    """Get a single application by ID."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    doc = await db.metrics_applications.find_one({"_id": ObjectId(app_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize_doc(doc)


@router.put("/{app_id}",response_description="Update a new monitored application",
    dependencies=[Depends(require_any_privilege(["create_update_metrics_monitoring"]))])
async def update_application(
    app_id: str,
    payload: ApplicationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update application name/description."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    update_fields = {}
    if payload.name is not None:
        # Check duplicate
        existing = await db.metrics_applications.find_one({"name": payload.name, "_id": {"$ne": ObjectId(app_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Application with this name already exists")
        update_fields["name"] = payload.name
    if payload.description is not None:
        update_fields["description"] = payload.description
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updatedAt"] = get_local_now().isoformat()
    result = await db.metrics_applications.find_one_and_update(
        {"_id": ObjectId(app_id)},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize_doc(result)


@router.delete("/{app_id}",
    dependencies=[Depends(require_any_privilege(["delete_metrics_monitoring"]))])
async def delete_application(
    app_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete an application."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
    result = await db.metrics_applications.delete_one({"_id": ObjectId(app_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"detail": "Application deleted"}


# ──────────────────────────────────────────────
# CRUD — Targets (within an application)
# ──────────────────────────────────────────────

@router.post("/{app_id}/targets", status_code=status.HTTP_201_CREATED,response_description="Update a new monitored application",
    dependencies=[Depends(require_any_privilege(["create_update_metrics_monitoring"]))])
async def add_target(
    app_id: str,
    payload: TargetCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add a target to an application."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    target_doc = payload.model_dump()
    result = await db.metrics_applications.find_one_and_update(
        {"_id": ObjectId(app_id)},
        {
            "$push": {"targets": target_doc},
            "$set": {"updatedAt": get_local_now().isoformat()},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize_doc(result)


@router.put("/{app_id}/targets/{target_idx}",response_description="Update a new monitored application",
    dependencies=[Depends(require_any_privilege(["create_update_metrics_monitoring"]))])
async def update_target(
    app_id: str,
    target_idx: int,
    payload: TargetUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a target within an application by index."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    doc = await db.metrics_applications.find_one({"_id": ObjectId(app_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    targets = doc.get("targets", [])
    if target_idx < 0 or target_idx >= len(targets):
        raise HTTPException(status_code=400, detail="Invalid target index")

    update_data = payload.model_dump(exclude_none=True)
    for key, val in update_data.items():
        targets[target_idx][key] = val

    result = await db.metrics_applications.find_one_and_update(
        {"_id": ObjectId(app_id)},
        {
            "$set": {"targets": targets, "updatedAt": get_local_now().isoformat()},
        },
        return_document=ReturnDocument.AFTER,
    )
    return serialize_doc(result)


@router.delete("/{app_id}/targets/{target_idx}",dependencies=[Depends(require_any_privilege(["delete_metrics_monitoring"]))])
async def delete_target(
    app_id: str,
    target_idx: int,
    current_user: dict = Depends(get_current_user),
):
    """Remove a target from an application by index."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    doc = await db.metrics_applications.find_one({"_id": ObjectId(app_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    targets = doc.get("targets", [])
    if target_idx < 0 or target_idx >= len(targets):
        raise HTTPException(status_code=400, detail="Invalid target index")

    targets.pop(target_idx)
    result = await db.metrics_applications.find_one_and_update(
        {"_id": ObjectId(app_id)},
        {
            "$set": {"targets": targets, "updatedAt": get_local_now().isoformat()},
        },
        return_document=ReturnDocument.AFTER,
    )
    return serialize_doc(result)


# ──────────────────────────────────────────────
# Live Scrape Endpoints
# ──────────────────────────────────────────────

@router.get("/{app_id}/live")
async def live_scrape_application(
    app_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Live-scrape all targets of an application."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    doc = await db.metrics_applications.find_one({"_id": ObjectId(app_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    targets = doc.get("targets", [])
    if not targets:
        return {"appId": app_id, "appName": doc.get("name"), "targets": [], "scrapedAt": datetime.now(timezone.utc).isoformat()}

    # Scrape all targets concurrently
    results = await asyncio.gather(*[scrape_target(t) for t in targets], return_exceptions=True)

    target_results = []
    for i, res in enumerate(results):
        if isinstance(res, Exception):
            target_results.append({
                **targets[i],
                "overallStatus": "ERROR",
                "error": str(res),
                "targetIndex": i,
            })
        else:
            res["targetIndex"] = i
            target_results.append(res)

    # Summary counts
    up_count = sum(1 for t in target_results if t.get("overallStatus") == "UP")
    down_count = len(target_results) - up_count

    return {
        "appId": app_id,
        "appName": doc.get("name"),
        "targets": target_results,
        "summary": {
            "total": len(target_results),
            "up": up_count,
            "down": down_count,
        },
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{app_id}/targets/{target_idx}/live")
async def live_scrape_target(
    app_id: str,
    target_idx: int,
    current_user: dict = Depends(get_current_user),
):
    """Live-scrape a single target."""
    if not ObjectId.is_valid(app_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")

    doc = await db.metrics_applications.find_one({"_id": ObjectId(app_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    targets = doc.get("targets", [])
    if target_idx < 0 or target_idx >= len(targets):
        raise HTTPException(status_code=400, detail="Invalid target index")

    result = await scrape_target(targets[target_idx])
    result["targetIndex"] = target_idx
    return result
