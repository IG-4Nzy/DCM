from datetime import datetime, timezone
from fastapi import Request
from database import db
from bson import ObjectId

FIELD_NAME_MAP = {
    "vmName": "VM Name",
    "node": "Node Name",
    "hostName": "Host Name",
    "ipAddress": "IP Address",
    "ip": "IP Address",
    "osAndExpiry": "OS & Expiry",
    "os": "Operating System",
    "hypervisor": "Hypervisor",
    "networkType": "Network Type",
    "applications": "Applications",
    "powerStatus": "Power Status",
    "adminContact": "Admin Contact Number",
    "hdd": "HDD",
    "totalHardisk": "Total HDD",
    "ram": "RAM",
    "totalRam": "Total RAM",
    "cpu": "CPU",
    "totalCpu": "Total CPU",
    "gpu": "GPU",
    "totalGpu": "Total GPU",
    "rack": "Server Rack",
    "rackPosition": "Rack Position",
    "rackUnits": "Rack Units",
    "serialNumber": "Serial Number",
    "assetNumber": "Asset Number",
    "custodian": "Custodian",
    "indentor": "Indentor",
    "poNum": "PO Number",
    "admin": "Admin",
    "adminName": "Admin Name",
    "clusterId": "Cluster ID",
    "backupName": "Backup Name",
    "backupNode": "Backup Node",
    "backupStorage": "Backup Storage",
    "datastore": "Datastore",
    "isNetworkConnected": "Network Connected",
    "isPhysicalServer": "Is Physical Server",
    "isStorage": "Is Storage System",
    "isAppliance": "Is Appliance / Network Device",
    "redundancyPower": "Redundancy Power",
    "remarks": "Remarks"
}

def get_client_ip(request: Request) -> str:
    if not request:
        return "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

def format_value(val):
    if val is None:
        return "--"
    if isinstance(val, bool):
        return "True" if val else "False"
    if isinstance(val, list):
        return ", ".join(str(x) for x in val) if val else "--"
    val_str = str(val).strip()
    return val_str if val_str else "--"

async def log_entity_update(
    request: Request,
    current_user: dict,
    entity_type: str,
    entity_id: str,
    entity_name: str,
    old_doc: dict,
    new_data: dict
):
    try:
        username = current_user.get("sub") or current_user.get("username") or "Unknown"
        user_ip = get_client_ip(request)
        
        ignored_fields = {"updatedAt", "updatedBy", "createdAt", "_id", "clones", "snapshots", "templates"}
        
        changes = []
        for key, new_val in new_data.items():
            if key in ignored_fields:
                continue
            
            old_val = old_doc.get(key)
            formatted_old = format_value(old_val)
            formatted_new = format_value(new_val)
            
            if formatted_old != formatted_new:
                changes.append({
                    "field": FIELD_NAME_MAP.get(key, key),
                    "fieldName": key,
                    "from": formatted_old,
                    "to": formatted_new
                })
        
        if not changes:
            return
            
        vm_id = str(old_doc.get("vmId") or new_data.get("vmId") or "")
        ip_addr = str(old_doc.get("ipAddress") or old_doc.get("ip") or new_data.get("ipAddress") or new_data.get("ip") or "")
        host_name = str(old_doc.get("hostName") or old_doc.get("node") or new_data.get("hostName") or new_data.get("node") or "")

        history_col = db.get_collection("infrastructure_update_history")
        history_doc = {
            "entityType": entity_type,
            "entityId": str(entity_id),
            "entityName": entity_name or "Unnamed",
            "vmId": vm_id,
            "ipAddress": ip_addr,
            "hostName": host_name,
            "username": username,
            "userIp": user_ip,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "changes": changes
        }
        
        await history_col.insert_one(history_doc)
        
        # Also post to global audit logs collection for unified auditing
        audit_col = db.get_collection("audit_logs")
        change_summary = "; ".join(f"{c['field']}: '{c['from']}' -> '{c['to']}'" for c in changes)
        await audit_col.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "user": username,
            "ipAddress": user_ip,
            "action": f"Updated {entity_type.upper()}: {entity_name}",
            "details": f"Updated fields: {change_summary}"
        })
    except Exception as e:
        print(f"Error logging infrastructure update history: {e}")

async def record_audit_log(
    request: Request,
    current_user: dict,
    action: str,
    details: str,
    before_state: dict = None,
    after_state: dict = None
):
    try:
        username = current_user.get("sub") or current_user.get("username") or "Unknown"
        user_ip = get_client_ip(request)
        
        log_doc = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "user": username,
            "ipAddress": user_ip,
            "action": action,
            "details": details
        }
        
        def sanitize_doc(doc):
            if not doc or not isinstance(doc, dict):
                return None
            res = {}
            for k, v in doc.items():
                if k in ("_id", "updatedAt"):
                    res[k] = str(v)
                elif k == "password":
                    res[k] = "[Password Hidden]"
                else:
                    res[k] = v
            return res

        if before_state is not None:
            log_doc["beforeState"] = sanitize_doc(before_state)
        if after_state is not None:
            log_doc["afterState"] = sanitize_doc(after_state)
            
        audit_col = db.get_collection("audit_logs")
        await audit_col.insert_one(log_doc)
    except Exception as e:
        print(f"Error recording audit log: {e}")

def compute_diff_details(old_doc: dict, new_doc: dict, field_map: dict = None) -> str:
    if not old_doc or not new_doc:
        return ""
    changes = []
    ignored = {"_id", "updatedAt", "createdAt", "updatedBy"}
    all_keys = set(old_doc.keys()).union(set(new_doc.keys()))
    for key in sorted(all_keys):
        if key in ignored:
            continue
        old_val = old_doc.get(key)
        new_val = new_doc.get(key)
        if key == "password":
            if old_val != new_val:
                label = field_map.get(key, key) if field_map else key
                changes.append(f"{label}: '[Password Changed]'")
            continue
        fmt_old = format_value(old_val)
        fmt_new = format_value(new_val)
        if fmt_old != fmt_new:
            label = field_map.get(key, key) if field_map else key
            changes.append(f"{label}: '{fmt_old}' -> '{fmt_new}'")
    return "; ".join(changes) if changes else "No fields modified"

