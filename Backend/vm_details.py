import re
import logging
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import VMDetailsModel, CreateVMDetailsModel, UpdateVMDetailsModel, PaginatedVMDetailsModel
from bson import ObjectId
from datetime import datetime, timezone

logger = logging.getLogger("vm_details.router")

router = APIRouter()
collection = db.get_collection("vm_details")

async def sync_node_resources(node_name: str):
    if not node_name:
        return
    
    # 1. Fetch all VMs for this host name
    vms_collection = db.get_collection("vm_details")
    cursor = vms_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    vms = await cursor.to_list(length=None)
    
    def clean_int(value) -> int:
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        digits = "".join([c for c in str(value) if c.isdigit()])
        return int(digits) if digits else 0
        
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    for vm in vms:
        used_ram += clean_int(vm.get("ram"))
        used_hdd += clean_int(vm.get("hdd"))
        used_cpu += clean_int(vm.get("cpu"))
        
    # 2. Update node_details collection
    nd_collection = db.get_collection("node_details")
    # Fetch all nodes matching the hostname
    nd_cursor = nd_collection.find({"hostName": {"$regex": f"^{node_name}$", "$options": "i"}})
    nodes_nd = await nd_cursor.to_list(length=None)
    for node in nodes_nd:
        total_ram = clean_int(node.get("totalRam"))
        total_hdd = clean_int(node.get("totalHardisk"))
        total_cpu = clean_int(node.get("totalCpu"))
        
        await nd_collection.update_one(
            {"_id": node["_id"]},
            {"$set": {
                "availableRam": max(0, total_ram - used_ram) if node.get("totalRam") is not None else None,
                "availableHardisk": max(0, total_hdd - used_hdd) if node.get("totalHardisk") is not None else None,
                "availableCpu": max(0, total_cpu - used_cpu) if node.get("totalCpu") is not None else None,
            }}
        )
        
    # 3. Update global nodes collection
    nodes_collection = db.get_collection("nodes")
    node_cursor = nodes_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    global_nodes = await node_cursor.to_list(length=None)
    for node in global_nodes:
        total_ram = clean_int(node.get("totalRam"))
        total_hdd = clean_int(node.get("totalHardisk"))
        total_cpu = clean_int(node.get("totalCpu"))
        
        await nodes_collection.update_one(
            {"_id": node["_id"]},
            {"$set": {
                "availableRam": max(0, total_ram - used_ram) if node.get("totalRam") is not None else None,
                "availableHardisk": max(0, total_hdd - used_hdd) if node.get("totalHardisk") is not None else None,
                "availableCpu": max(0, total_cpu - used_cpu) if node.get("totalCpu") is not None else None,
            }}
        )

@router.get("/", response_description="List all VM details", response_model=PaginatedVMDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "VM View", "Create Request", "Update Request", "View Request"]))])
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    admin: Optional[str] = Query(None, description="Filter by admin username"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    privs = current_user.get("privileges", [])
    can_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs or "Create Server Details" in privs
    
    target_username = None
    if not can_view_all:
        target_username = current_user.get("sub")
    elif admin:
        target_username = admin

    if target_username:
        users_col = db.get_collection("users")
        user_doc = await users_col.find_one({"username": target_username})
        if not user_doc and ObjectId.is_valid(target_username):
            user_doc = await users_col.find_one({"_id": ObjectId(target_username)})
        admins = set()
        admins.add(target_username)
        if user_doc:
            admins.add(str(user_doc["_id"]))
            if user_doc.get("username"):
                admins.add(user_doc["username"])
        query["admin"] = {"$in": list(admins)}
    
    if clusterId:
        query["clusterId"] = clusterId
    
    if search:
        terms = search.strip().split()
        if terms:
            # Cross-entity lookup: find clusters matching any search term
            cluster_queries = []
            for term in terms:
                cluster_queries.append({"clusterName": {"$regex": term.replace('\\', '\\\\'), "$options": "i"}})
            clusters_col = db.get_collection("clusters")
            matching_clusters = await clusters_col.find({"$or": cluster_queries}, {"_id": 1}).to_list(length=None)
            matching_cluster_ids = [str(doc["_id"]) for doc in matching_clusters]

            term_queries = []
            for term in terms:
                escaped_term = term.replace('\\', '\\\\')
                
                or_conditions = [
                    {"ipAddress": {"$regex": escaped_term, "$options": "i"}},
                    {"vmId": {"$regex": escaped_term, "$options": "i"}},
                    {"applications": {"$regex": escaped_term, "$options": "i"}},
                    {"node": {"$regex": escaped_term, "$options": "i"}},
                    {"adminName": {"$regex": escaped_term, "$options": "i"}},
                    {"adminContact": {"$regex": escaped_term, "$options": "i"}},
                    {"osAndExpiry": {"$regex": escaped_term, "$options": "i"}},
                    {"hdd": {"$regex": escaped_term, "$options": "i"}},
                    {"ram": {"$regex": escaped_term, "$options": "i"}},
                    {"cpu": {"$regex": escaped_term, "$options": "i"}},
                    {"backupLocation": {"$regex": escaped_term, "$options": "i"}},
                    {"powerStatus": {"$regex": escaped_term, "$options": "i"}},
                    {"createdBy": {"$regex": escaped_term, "$options": "i"}},
                    {"createdAt": {"$regex": escaped_term, "$options": "i"}},
                    {"updatedAt": {"$regex": escaped_term, "$options": "i"}},
                ]

                if matching_cluster_ids:
                    or_conditions.append({"clusterId": {"$in": matching_cluster_ids}})

                term_queries.append({"$or": or_conditions})
            query["$and"] = term_queries

    actual_sort_by = sortBy or sort_by or "vmId"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}

@router.post("/", response_description="Create VM Details", response_model=VMDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateVMDetailsModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    max_vm_id = 0
    cursor = collection.find({"vmId": {"$regex": "^VM-"}}, {"vmId": 1})
    async for doc in cursor:
        vid = doc.get("vmId", "")
        if vid.startswith("VM-"):
            try:
                num = int(vid.replace("VM-", ""))
                max_vm_id = max(max_vm_id, num)
            except:
                pass
    item_dict["vmId"] = f"VM-{max_vm_id + 1:02d}"

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    if created and created.get("node"):
        await sync_node_resources(created["node"])
    return created

@router.post("/import-vcenter", dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details"]))])
async def import_vcenter_vms(
    vcenterId: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    vcenters_col = db.get_collection("vcenter_details")
    snap_col = db.get_collection("vcenter_telemetry")
    
    query = {}
    if vcenterId and ObjectId.is_valid(vcenterId):
        query["_id"] = ObjectId(vcenterId)
        
    vcenters = await vcenters_col.find(query).to_list(length=None)
    if not vcenters:
        raise HTTPException(status_code=404, detail="No vCenter appliances found")
        
    max_vm_id = 0
    cursor = collection.find({"vmId": {"$regex": "^VM-"}}, {"vmId": 1})
    async for doc in cursor:
        vid = doc.get("vmId", "")
        if vid.startswith("VM-"):
            try:
                num = int(vid.replace("VM-", ""))
                max_vm_id = max(max_vm_id, num)
            except:
                pass

    inserted_count = 0
    updated_count = 0

    for vc in vcenters:
        vc_id_str = str(vc["_id"])
        cluster_id = vc.get("clusterId", "")
        
        snap = await snap_col.find_one({"vcenterId": vc_id_str})
        vms = snap.get("vms", []) if snap else []
        
        if not vms and vc.get("ipAddress") and vc.get("username") and vc.get("password"):
            try:
                from services.vcenter.session_manager import vcenter_session_manager
                from services.vcenter.inventory_service import vcenter_inventory_service
                session_id = await vcenter_session_manager.get_session(vc["ipAddress"], vc["username"], vc["password"])
                if session_id:
                    live_vms = await vcenter_inventory_service.get_vms(vc["ipAddress"], session_id, cluster_id or None)
                    vms = []
                    for vm in live_vms:
                        host_ref = vm.get("host") or vm.get("hostName") or ""
                        vms.append({
                            "id": vm.get("vm") or vm.get("vm_id") or vm.get("name", ""),
                            "name": vm.get("name", ""),
                            "ipAddress": vm.get("ipAddress") or "0.0.0.0",
                            "node": host_ref or "Unassigned",
                            "status": "Running" if vm.get("power_state") in ("POWERED_ON", "poweredOn") else "Stopped"
                        })
            except Exception as e:
                logger.error(f"Error fetching live VMs during import for vCenter {vc_id_str}: {e}")

        for vm in vms:
            vm_name = (vm.get("name") or vm.get("id") or "").strip()
            if not vm_name:
                continue

            raw_ip = str(vm.get("ipAddress") or "").strip()
            ip_address = raw_ip if raw_ip and raw_ip != "0.0.0.0" else ""

            raw_node = str(vm.get("node") or "").strip()
            node = raw_node if raw_node and raw_node.lower() != "unassigned" else ""

            status_str = str(vm.get("status") or "").lower()
            power_status = "on" if status_str in ("running", "powered_on", "poweredon", "on") else "off"

            vm_id_val = str(vm.get("id") or "").strip()

            existing = await collection.find_one({
                "$or": [
                    {"vmName": {"$regex": f"^{re.escape(vm_name)}$", "$options": "i"}},
                    {"vmId": vm_id_val} if vm_id_val else {"_id": None}
                ]
            })

            if existing:
                update_fields = {}
                if ip_address and not existing.get("ipAddress"):
                    update_fields["ipAddress"] = ip_address
                if node and not existing.get("node"):
                    update_fields["node"] = node
                if power_status != existing.get("powerStatus"):
                    update_fields["powerStatus"] = power_status
                if cluster_id and not existing.get("clusterId"):
                    update_fields["clusterId"] = cluster_id

                if update_fields:
                    update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
                    await collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
                    updated_count += 1
            else:
                max_vm_id += 1
                final_vm_id = vm_id_val if vm_id_val else f"VM-{max_vm_id:02d}"
                new_vm_doc = {
                    "vmId": final_vm_id,
                    "vmName": vm_name,
                    "clusterId": cluster_id,
                    "ipAddress": ip_address,
                    "applications": "",
                    "node": node,
                    "osAndExpiry": "",
                    "backupLocation": "",
                    "admin": [],
                    "adminName": "",
                    "adminContact": "",
                    "powerStatus": power_status,
                    "hdd": "",
                    "ram": "",
                    "cpu": "",
                    "createdBy": current_user.get("sub", ""),
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                await collection.insert_one(new_vm_doc)
                inserted_count += 1

    return {
        "message": f"Bulk import complete: {inserted_count} new VMs imported, {updated_count} existing VMs updated.",
        "imported": inserted_count,
        "updated": updated_count
    }

@router.put("/{id}", response_description="Update VM details", response_model=VMDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdateVMDetailsModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    old_vm = await collection.find_one({"_id": ObjectId(id)})
    if not old_vm:
        raise HTTPException(status_code=404, detail="VM Details not found")
    old_node = old_vm.get("node")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            # Sync name/ip changes to monitored_servers and monitoring_status collections
            old_ip = old_vm.get("ipAddress")
            old_name = old_vm.get("vmId")
            new_name = item_dict.get("vmId")
            new_ip = item_dict.get("ipAddress")

            if old_ip or old_name:
                monitoring_col = db.get_collection("monitored_servers")
                query = {}
                if old_ip:
                    query["ipAddress"] = old_ip
                elif old_name:
                    query["name"] = old_name

                monitored_srv = await monitoring_col.find_one(query)
                if monitored_srv:
                    srv_id = str(monitored_srv["_id"])
                    monitor_update = {}
                    if new_name:
                        monitor_update["name"] = new_name
                    if new_ip:
                        monitor_update["ipAddress"] = new_ip

                    if monitor_update:
                        await monitoring_col.update_one({"_id": monitored_srv["_id"]}, {"$set": monitor_update})
                        
                        status_col = db.get_collection("monitoring_status")
                        status_update = {}
                        if "name" in monitor_update:
                            status_update["name"] = monitor_update["name"]
                        if "ipAddress" in monitor_update:
                            status_update["ipAddress"] = monitor_update["ipAddress"]
                        await status_col.update_one({"serverId": srv_id}, {"$set": status_update})

            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                if old_node:
                    await sync_node_resources(old_node)
                new_node = updated.get("node")
                if new_node and new_node != old_node:
                    await sync_node_resources(new_node)
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail="VM Details not found")

@router.get("/{id}/history", dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "VM View", "View Request"]))])
async def get_vm_history(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    vm = await collection.find_one({"_id": ObjectId(id)})
    if not vm:
        raise HTTPException(status_code=404, detail="VM Details not found")

    vm_db_id = str(vm["_id"])
    vm_id_field = vm.get("vmId")
    vm_name = vm.get("applications")
    vm_ip = vm.get("ipAddress")

    match_conditions = []
    if vm_db_id:
        match_conditions.append({"details.vmId": vm_db_id})
    if vm_id_field:
        match_conditions.append({"details.vmId": vm_id_field})
        match_conditions.append({"details.vmName": vm_id_field})
    if vm_name:
        match_conditions.append({"details.vmName": vm_name})
        match_conditions.append({"details.applications": vm_name})
    if vm_ip:
        match_conditions.append({"details.ip": vm_ip})
        match_conditions.append({"details.ipAddress": vm_ip})

    if not match_conditions:
        return {"history": []}

    query = {
        "requestType": {"$in": ["VM Creation", "VM Management"]},
        "$or": match_conditions
    }

    requests_col = db.get_collection("requests")
    cursor = requests_col.find(query)
    requests_list = await cursor.to_list(length=None)

    if not requests_list:
        return {"history": []}

    req_map = {str(r["_id"]): r for r in requests_list}
    request_ids = list(req_map.keys())

    logs_col = db.get_collection("request_logs")
    logs_cursor = logs_col.find({"requestId": {"$in": request_ids}})
    logs_list = await logs_cursor.to_list(length=None)

    # Collect usernames to resolve full names
    usernames = set()
    for r in requests_list:
        if r.get("createdBy"):
            usernames.add(r["createdBy"])
    for l in logs_list:
        if l.get("user"):
            usernames.add(l["user"])

    users_col = db.get_collection("users")
    user_map = {}
    if usernames:
        users = await users_col.find({"username": {"$in": list(usernames)}}).to_list(length=None)
        for u in users:
            name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
            user_map[u.get("username")] = name or u.get("username")

    history = []
    for log in logs_list:
        req_id = log.get("requestId")
        req = req_map.get(req_id)
        if not req:
            continue

        req_type = req.get("requestType") or req.get("category") or "VM Request"
        req_seq_id = req.get("requestId") or "REQ"
        
        who_requested = user_map.get(req.get("createdBy"), req.get("createdBy"))
        who_did = user_map.get(log.get("user"), log.get("user"))
        what_did = log.get("action")
        timestamp = log.get("timestamp")
        
        log_details = log.get("details") or ""
        remarks = log.get("remarks")
        if remarks:
            log_details += f" (Remarks: {remarks})"

        req_details = req.get("details") or {}
        operation_type = req_details.get("operationType")
        
        op_info = ""
        if req_type == "VM Management" and operation_type:
            op_info = f" [{operation_type}"
            if operation_type == "Migration" and req_details.get("migrationNode"):
                op_info += f" to Node: {req_details.get('migrationNode')}"
            elif operation_type == "Resource Upgrade":
                op_info += f" (RAM: {req_details.get('newRam')}, HDD: {req_details.get('newHdd')}, CPU: {req_details.get('newCpu')})"
            op_info += "]"

        history.append({
            "requestId": req_seq_id,
            "requestType": f"{req_type}{op_info}",
            "whoRequested": who_requested,
            "whoDid": who_did,
            "whatDid": what_did,
            "time": timestamp,
            "details": log_details
        })

    history.sort(key=lambda x: x.get("time") or "", reverse=True)
    return {"history": history}

@router.delete("/{id}", response_description="Delete VM details", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    vm = await collection.find_one({"_id": ObjectId(id)})
    node_name = vm.get("node") if vm else None

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        if node_name:
            await sync_node_resources(node_name)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="VM Details not found")
