import re
import logging
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from auth_utils import require_privilege, require_any_privilege, get_current_user
from history_helper import log_entity_update
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import VMDetailsModel, CreateVMDetailsModel, UpdateVMDetailsModel, PaginatedVMDetailsModel
from bson import ObjectId
from datetime import datetime, timezone

logger = logging.getLogger("vm_details.router")

router = APIRouter()
collection = db.get_collection("vm_details")

def parse_sl_number(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    value_str = str(value).strip()
    try:
        return int(float(value_str))
    except ValueError:
        digits = "".join(c for c in value_str if c.isdigit())
        return int(digits) if digits else 0

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

async def fix_missing_vm_fields():
    """Auto-repair any existing VM details missing vmId, vmName, or adminName."""
    try:
        vms_col = db.get_collection("vm_details")
        users_col = db.get_collection("users")
        
        # 1. Fix missing vmId
        vms_without_id = await vms_col.find({
            "$or": [
                {"vmId": None},
                {"vmId": ""},
                {"vmId": {"$exists": False}}
            ]
        }).to_list(length=None)
        
        if vms_without_id:
            max_vm_id = 0
            cursor = vms_col.find({"vmId": {"$regex": "^VM-"}}, {"vmId": 1})
            async for doc in cursor:
                vid = doc.get("vmId", "")
                if vid.startswith("VM-"):
                    try:
                        num = int(vid.replace("VM-", ""))
                        max_vm_id = max(max_vm_id, num)
                    except Exception:
                        pass
            
            for vm_doc in vms_without_id:
                max_vm_id += 1
                new_vm_id = f"VM-{max_vm_id}"
                await vms_col.update_one({"_id": vm_doc["_id"]}, {"$set": {"vmId": new_vm_id}})

        # 2. Fix missing vmName
        vms_without_name = await vms_col.find({
            "$or": [
                {"vmName": None},
                {"vmName": ""},
                {"vmName": {"$exists": False}}
            ]
        }).to_list(length=None)
        
        for vm_doc in vms_without_name:
            fallback_name = vm_doc.get("applications") or vm_doc.get("vmId") or "VM"
            await vms_col.update_one({"_id": vm_doc["_id"]}, {"$set": {"vmName": fallback_name}})

        # 3. Fix missing adminName
        vms_without_admin_name = await vms_col.find({
            "$or": [
                {"adminName": None},
                {"adminName": ""},
                {"adminName": {"$exists": False}}
            ]
        }).to_list(length=None)
        
        for vm_doc in vms_without_admin_name:
            admin_val = vm_doc.get("admin") or vm_doc.get("createdBy")
            if admin_val and admin_val != "system":
                user_obj = await users_col.find_one({"username": admin_val})
                if user_obj:
                    full_name = f"{user_obj.get('firstName', '')} {user_obj.get('lastName', '')}".strip() or admin_val
                    await vms_col.update_one({"_id": vm_doc["_id"]}, {"$set": {"adminName": full_name}})
                else:
                    await vms_col.update_one({"_id": vm_doc["_id"]}, {"$set": {"adminName": admin_val}})
            else:
                await vms_col.update_one({"_id": vm_doc["_id"]}, {"$set": {"adminName": "System Admin"}})
    except Exception as e:
        logger.error(f"Error in fix_missing_vm_fields: {e}")

@router.get("/", response_description="List all VM details", response_model=PaginatedVMDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "VM View", "Create Request", "Update Request", "View Request", "Update VMs (Restricted)"]))])
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    admin: Optional[str] = Query(None, description="Filter by admin username"),
    node: Optional[str] = Query(None, description="Filter by node name"),
    powerStatus: Optional[str] = Query(None, description="Filter by power status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    networkType: Optional[str] = Query(None, description="Filter by node network type (internet/intranet)"),
    clusterType: Optional[str] = Query(None, description="Filter by cluster type"),
    current_user: dict = Depends(get_current_user)
):
    await fix_missing_vm_fields()
    if not isinstance(admin, str):
        admin = None
    if not isinstance(clusterId, str):
        clusterId = None
    if not isinstance(node, str):
        node = None
    if not isinstance(powerStatus, str):
        powerStatus = None
    if not isinstance(networkType, str):
        networkType = None
    if not isinstance(clusterType, str):
        clusterType = None
    if not isinstance(sortBy, str):
        sortBy = None
    if not isinstance(sort_by, str):
        sort_by = None
    if not isinstance(order, str):
        order = "asc"
    if not isinstance(skip, int):
        skip = 0
    if not isinstance(limit, int):
        limit = 10
    if not isinstance(pagination, bool):
        pagination = True

    and_conditions = []
    
    privs = current_user.get("privileges", [])
    can_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs
    
    # Conditions that match records with no admin assigned
    no_admin_conditions = [
        {"admin": None},
        {"admin": ""},
        {"admin": []},
        {"admin": {"$exists": False}}
    ]

    # Resolve current user admin identifiers
    target_username = current_user.get("sub")
    users_col = db.get_collection("users")
    user_doc = await users_col.find_one({"username": target_username})
    if not user_doc and ObjectId.is_valid(target_username):
        user_doc = await users_col.find_one({"_id": ObjectId(target_username)})
    user_admins = set()
    user_admins.add(target_username)
    if user_doc:
        user_admins.add(str(user_doc["_id"]))
        if user_doc.get("username"):
            user_admins.add(user_doc["username"])

    has_dept_priv = "view_department_devices" in privs
    current_dept = user_doc.get("department") if user_doc else None
    if has_dept_priv and current_dept:
        dept_users = await users_col.find({"department": current_dept}).to_list(length=None)
        for du in dept_users:
            user_admins.add(du["username"])
            user_admins.add(str(du["_id"]))

    if can_view_all:
        if admin:
            if admin.lower() == "unassigned":
                and_conditions.append({"$or": no_admin_conditions})
            elif admin.lower() == "my_unassigned":
                and_conditions.append({
                    "$or": [
                        {"admin": {"$in": list(user_admins)}},
                        *no_admin_conditions
                    ]
                })
            elif admin.lower() == "assigned":
                and_conditions.append({"admin": {"$in": list(user_admins)}})
            elif admin.lower() == "other":
                users_col_adm = db.get_collection("users")
                all_users = await users_col_adm.find({}, {"_id": 1, "username": 1}).to_list(length=None)
                known_ids = set()
                for u in all_users:
                    known_ids.add(str(u["_id"]))
                    if u.get("username"):
                        known_ids.add(u["username"])
                and_conditions.append({
                    "$and": [
                        {"admin": {"$exists": True, "$ne": None, "$ne": "", "$ne": []}},
                        {"admin": {"$nin": list(known_ids)}}
                    ]
                })
            else:
                adm_doc = await users_col.find_one({"username": admin})
                if not adm_doc and ObjectId.is_valid(admin):
                    adm_doc = await users_col.find_one({"_id": ObjectId(admin)})
                target_admins = set()
                target_admins.add(admin)
                if adm_doc:
                    target_admins.add(str(adm_doc["_id"]))
                    if adm_doc.get("username"):
                        target_admins.add(adm_doc["username"])
                and_conditions.append({"admin": {"$in": list(target_admins)}})
    else:
        if admin:
            if admin.lower() == "unassigned":
                and_conditions.append({"$or": no_admin_conditions})
            elif admin.lower() == "my_unassigned":
                and_conditions.append({
                    "$or": [
                        {"admin": {"$in": list(user_admins)}},
                        *no_admin_conditions
                    ]
                })
            elif admin.lower() == "assigned":
                and_conditions.append({"admin": {"$in": list(user_admins)}})
            else:
                if has_dept_priv:
                    adm_doc = await users_col.find_one({"username": admin})
                    if not adm_doc and ObjectId.is_valid(admin):
                        adm_doc = await users_col.find_one({"_id": ObjectId(admin)})
                    target_admins = set()
                    target_admins.add(admin)
                    if adm_doc:
                        target_admins.add(str(adm_doc["_id"]))
                        if adm_doc.get("username"):
                            target_admins.add(adm_doc["username"])
                    allowed_filter = list(target_admins.intersection(user_admins))
                    and_conditions.append({"admin": {"$in": allowed_filter}})
                else:
                    and_conditions.append({"admin": {"$in": list(user_admins)}})
        else:
            and_conditions.append({
                "$or": [
                    {"admin": {"$in": list(user_admins)}},
                    *no_admin_conditions
                ]
            })
    
    if clusterId:
        and_conditions.append({"clusterId": clusterId})
        
    if node:
        and_conditions.append({"node": node})

    if powerStatus:
        and_conditions.append({"powerStatus": re.compile(f"^{re.escape(powerStatus)}$", re.I)})

    if networkType and networkType.strip():
        nt_val = networkType.strip().lower()
        if nt_val == "disconnected":
            and_conditions.append({"isNetworkConnected": False})
        elif nt_val == "internet":
            and_conditions.append({
                "$or": [
                    {"networkType": re.compile("^internet$", re.I)},
                    {"ipAddress": re.compile(r"^192\.168\.")},
                    {"ip": re.compile(r"^192\.168\.")}
                ]
            })
        elif nt_val == "intranet":
            and_conditions.append({
                "$or": [
                    {"networkType": re.compile("^intranet$", re.I)},
                    {"ipAddress": re.compile(r"^10\.")},
                    {"ip": re.compile(r"^10\.")}
                ]
            })
        else:
            and_conditions.append({
                "networkType": re.compile(f"^{re.escape(nt_val)}$", re.I)
            })

    if clusterType and clusterType.strip():
        ct_val = clusterType.strip()
        clusters_col = db.get_collection("clusters")
        matching_clusters_cursor = clusters_col.find({"clusterType": re.compile(f"^{re.escape(ct_val)}$", re.I)}, {"_id": 1})
        matching_clusters = await matching_clusters_cursor.to_list(length=None)
        cluster_ids = [str(c["_id"]) for c in matching_clusters]
        if not cluster_ids:
            and_conditions.append({"clusterId": "__NON_EXISTENT_CLUSTER__"})
        else:
            and_conditions.append({"clusterId": {"$in": cluster_ids}})
    
    if search:
        search_parts = [p.strip() for p in search.split(",") if p.strip()]
        if not search_parts:
            search_parts = [search.strip()]

        from search_utils import resolve_search_references
        
        all_or_conditions = []
        for part in search_parts:
            matched_users, matched_clusters, _, matched_ips = await resolve_search_references(part)
            escaped_search = re.escape(part)
            regex_pat = re.compile(escaped_search, re.I)
            
            or_conditions = [
                {"ipAddress": regex_pat},
                {"ip": regex_pat},
                {"vmId": regex_pat},
                {"vmName": regex_pat},
                {"applications": regex_pat},
                {"node": regex_pat},
                {"adminName": regex_pat},
                {"adminContact": regex_pat},
                {"osAndExpiry": regex_pat},
                {"hdd": regex_pat},
                {"ram": regex_pat},
                {"cpu": regex_pat},
                {"backupName": regex_pat},
                {"backupNode": regex_pat},
                {"backupStorage": regex_pat},
                {"backupDatastore": regex_pat},
                {"datastore": regex_pat},
                {"powerStatus": regex_pat},
                {"createdBy": regex_pat},
                {"createdAt": regex_pat},
                {"updatedAt": regex_pat},
                {"remarks": regex_pat},
            ]
            if matched_users:
                or_conditions.append({"admin": {"$in": matched_users}})
            if matched_clusters:
                or_conditions.append({"clusterId": {"$in": [str(c) for c in matched_clusters] + matched_clusters}})
            if matched_ips:
                or_conditions.append({"ipAddress": {"$in": matched_ips}})
                or_conditions.append({"ip": {"$in": matched_ips}})
                
            all_or_conditions.extend(or_conditions)
            
        if all_or_conditions:
            and_conditions.append({"$or": all_or_conditions})

    query = {"$and": and_conditions} if len(and_conditions) > 1 else (and_conditions[0] if and_conditions else {})

    actual_sort_by = sortBy or sort_by or "vmId"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).collation({"locale": "en", "numericOrdering": True}).sort(actual_sort_by, sort_order)
    
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

    ip_val = str(item_dict.get("ipAddress") or item_dict.get("ip") or "").strip()
    if ip_val.startswith("192.168"):
        item_dict["networkType"] = "internet"
    elif ip_val.startswith("10."):
        item_dict["networkType"] = "intranet"
    
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
    item_dict["vmId"] = f"VM-{max_vm_id + 1}"

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
    if not current_user.get("isSuperuser"):
        raise HTTPException(status_code=403, detail="Only superusers can import VMs from vCenter")
    try:
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
        skipped_count = 0

        clusters_col = db.get_collection("clusters")

        for vc in vcenters:
            vc_id_str = str(vc["_id"])
            vc_cluster_id = vc.get("clusterId", "")
            
            vcenter_cluster_map = {}

            # Attempt live cluster resolution from vCenter API if credentials exist
            if vc.get("ipAddress") and vc.get("username") and vc.get("password"):
                try:
                    from services.vcenter.session_manager import vcenter_session_manager
                    from services.vcenter.inventory_service import vcenter_inventory_service
                    session_id = await vcenter_session_manager.get_session(vc["ipAddress"], vc["username"], vc["password"])
                    if session_id:
                        vc_clusters = await vcenter_inventory_service.get_clusters(vc["ipAddress"], session_id)
                        for c_item in (vc_clusters or []):
                            moref = c_item.get("cluster") or c_item.get("id") or ""
                            c_name = c_item.get("name") or c_item.get("cluster_name") or moref
                            if not c_name:
                                continue
                                
                            db_cluster = await clusters_col.find_one({
                                "$or": [
                                    {"clusterName": {"$regex": f"^{re.escape(c_name)}$", "$options": "i"}},
                                    {"vcenterClusterId": moref},
                                    {"_id": ObjectId(moref)} if ObjectId.is_valid(moref) else {"_id": None}
                                ]
                            })
                            
                            if not db_cluster and c_name:
                                cursor = clusters_col.find({}, {"slNumber": 1})
                                max_sl = 0
                                async for doc in cursor:
                                    max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
                                display_name = c_name if not c_name.startswith("domain-") else f"Cluster {c_name}"
                                new_c_doc = {
                                    "slNumber": str(max_sl + 1),
                                    "clusterName": display_name,
                                    "vcenterClusterId": moref,
                                    "ipAddress": vc.get("ipAddress", ""),
                                    "createdBy": current_user.get("sub", "vCenter Import"),
                                    "updatedAt": datetime.now(timezone.utc).isoformat()
                                }
                                ins = await clusters_col.insert_one(new_c_doc)
                                db_cluster = await clusters_col.find_one({"_id": ins.inserted_id})
                            
                            if db_cluster:
                                db_c_id = str(db_cluster["_id"])
                                if moref:
                                    vcenter_cluster_map[moref] = db_c_id
                                vcenter_cluster_map[c_name] = db_c_id
                                vcenter_cluster_map[c_name.lower()] = db_c_id
                except Exception as e:
                    logger.warning(f"Failed resolving vCenter clusters during import: {e}")

            # Determine fallback cluster ID for this vcenter appliance
            fallback_cluster_id = ""
            if vc_cluster_id:
                if vcenter_cluster_map.get(vc_cluster_id):
                    fallback_cluster_id = vcenter_cluster_map[vc_cluster_id]
                else:
                    db_c = await clusters_col.find_one({
                        "$or": [
                            {"_id": ObjectId(vc_cluster_id)} if ObjectId.is_valid(vc_cluster_id) else {"_id": None},
                            {"clusterName": {"$regex": f"^{re.escape(vc_cluster_id)}$", "$options": "i"}},
                            {"vcenterClusterId": vc_cluster_id}
                        ]
                    })
                    if db_c:
                        fallback_cluster_id = str(db_c["_id"])
                    else:
                        cursor = clusters_col.find({}, {"slNumber": 1})
                        max_sl = 0
                        async for doc in cursor:
                            max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
                        c_name = vc_cluster_id if not vc_cluster_id.startswith("domain-") else f"Cluster {vc_cluster_id}"
                        ins = await clusters_col.insert_one({
                            "slNumber": str(max_sl + 1),
                            "clusterName": c_name,
                            "vcenterClusterId": vc_cluster_id,
                            "createdBy": current_user.get("sub", "vCenter Import"),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        })
                        fallback_cluster_id = str(ins.inserted_id)

            snap = await snap_col.find_one({"vcenterId": vc_id_str})
            vms = snap.get("vms", []) if snap else []
            
            session_id = None
            vcenter_host_to_node = {}     # Maps vCenter host moref/name → DB node name
            vcenter_host_to_cluster = {}  # Maps vCenter host moref → vCenter cluster moref/name

            if vc.get("ipAddress") and vc.get("username") and vc.get("password"):
                try:
                    from services.vcenter.session_manager import vcenter_session_manager
                    from services.vcenter.inventory_service import vcenter_inventory_service
                    session_id = await vcenter_session_manager.get_session(vc["ipAddress"], vc["username"], vc["password"])
                    if session_id:
                        # --- Fetch ALL ESXi hosts across ALL clusters in vCenter ---
                        try:
                            vc_hosts = await vcenter_inventory_service.get_hosts(vc["ipAddress"], session_id)
                            nodes_col = db.get_collection("nodes")
                            node_details_col = db.get_collection("node_details")

                            all_db_nodes = await nodes_col.find({}, {"node": 1, "nodeId": 1, "ip": 1, "ipAddress": 1, "managementIp": 1}).to_list(length=None)
                            all_db_node_details = await node_details_col.find({}, {"hostName": 1, "nodeId": 1, "ipAddress": 1}).to_list(length=None)

                            # Build lookup indices from DB nodes & node_details: by name/hostName/nodeId (lowercase) and by IP
                            node_by_name = {}
                            node_by_ip = {}

                            for db_node in all_db_nodes:
                                n_name = db_node.get("node") or db_node.get("nodeId") or ""
                                if n_name:
                                    node_by_name[n_name.lower()] = n_name
                                if db_node.get("nodeId"):
                                    node_by_name[str(db_node["nodeId"]).lower()] = n_name or str(db_node["nodeId"])
                                for ip_field in ["ip", "ipAddress", "managementIp"]:
                                    ip_val = db_node.get(ip_field)
                                    if ip_val:
                                        for single_ip in str(ip_val).split(","):
                                            single_ip = single_ip.strip()
                                            if single_ip:
                                                node_by_ip[single_ip] = n_name

                            for db_nd in all_db_node_details:
                                nd_name = db_nd.get("hostName") or db_nd.get("nodeId") or ""
                                if nd_name:
                                    node_by_name[nd_name.lower()] = nd_name
                                if db_nd.get("nodeId"):
                                    node_by_name[str(db_nd["nodeId"]).lower()] = nd_name or str(db_nd["nodeId"])
                                if db_nd.get("ipAddress"):
                                    for single_ip in str(db_nd["ipAddress"]).split(","):
                                        single_ip = single_ip.strip()
                                        if single_ip:
                                            node_by_ip[single_ip] = nd_name

                            for h in (vc_hosts or []):
                                h_moref = h.get("host") or h.get("host_id") or ""
                                h_name = h.get("name") or ""
                                h_ip = h.get("ip_address") or h.get("ipAddress") or ""
                                h_cluster = h.get("cluster") or h.get("cluster_id") or ""

                                # Build host -> cluster map
                                if h_cluster:
                                    if h_moref:
                                        vcenter_host_to_cluster[h_moref] = h_cluster
                                    if h_name:
                                        vcenter_host_to_cluster[h_name] = h_cluster
                                        vcenter_host_to_cluster[h_name.lower()] = h_cluster

                                resolved_node_name = ""
                                # Try matching by hostname / hostName
                                if h_name:
                                    resolved_node_name = node_by_name.get(h_name.lower(), "")
                                # Try matching by IP
                                if not resolved_node_name and h_ip:
                                    resolved_node_name = node_by_ip.get(h_ip, "")
                                # Try matching by moref
                                if not resolved_node_name and h_moref:
                                    resolved_node_name = node_by_name.get(h_moref.lower(), "")
                                # Try partial match: DB node name contained in vCenter hostname or vice versa
                                if not resolved_node_name and h_name:
                                    for db_n_lower, db_n_actual in node_by_name.items():
                                        if db_n_lower in h_name.lower() or h_name.lower() in db_n_lower:
                                            resolved_node_name = db_n_actual
                                            break

                                target_mapped_node = resolved_node_name if resolved_node_name else (h_name or h_ip or h_moref or "Unassigned")
                                if h_moref:
                                    vcenter_host_to_node[h_moref] = target_mapped_node
                                if h_name:
                                    vcenter_host_to_node[h_name] = target_mapped_node
                                    vcenter_host_to_node[h_name.lower()] = target_mapped_node
                                if h_ip:
                                    vcenter_host_to_node[h_ip] = target_mapped_node

                            logger.info(f"Built host-to-node map ({len(vcenter_host_to_node)}) and host-to-cluster map ({len(vcenter_host_to_cluster)}) for vCenter {vc_id_str}")
                        except Exception as e:
                            logger.warning(f"Failed building host maps for vCenter {vc_id_str}: {e}")

                        # --- Fetch ALL live VMs across ALL clusters in vCenter appliance ---
                        try:
                            live_vms = await vcenter_inventory_service.get_vms(vc["ipAddress"], session_id, cluster_id=None)

                            if live_vms:
                                parsed_vms = []
                                for vm in live_vms:
                                    host_ref = vm.get("host") or vm.get("host_id") or vm.get("hostName") or vm.get("node") or ""
                                    
                                    # Determine VM cluster: directly from VM or via host-to-cluster map
                                    vm_cluster_ref = vm.get("cluster") or vm.get("cluster_id") or vm.get("clusterId") or ""
                                    if not vm_cluster_ref and host_ref:
                                        vm_cluster_ref = vcenter_host_to_cluster.get(host_ref) or vcenter_host_to_cluster.get(str(host_ref).lower()) or ""

                                    cpu_cnt = vm.get("cpu_count") or vm.get("num_cpu") or vm.get("cpu")
                                    cpu_v = ""
                                    if cpu_cnt:
                                        count_val = cpu_cnt.get("count") if isinstance(cpu_cnt, dict) else cpu_cnt
                                        if count_val:
                                            cpu_v = f"{count_val} vCPU" if int(count_val) > 1 else "1 vCPU"

                                    mem_mb = vm.get("memory_size_MiB") or vm.get("memory_mb") or vm.get("ram")
                                    if isinstance(mem_mb, dict):
                                        mem_mb = mem_mb.get("size_MiB") or mem_mb.get("size")
                                    ram_v = f"{round(mem_mb / 1024)} GB" if isinstance(mem_mb, (int, float)) and mem_mb >= 512 else str(mem_mb or "")
                                    
                                    hdd_v = str(vm.get("hdd") or vm.get("disk_gb") or vm.get("storage") or "")
                                    os_v = str(vm.get("guest_OS") or vm.get("os") or vm.get("osAndExpiry") or "")
                                    
                                    parsed_vms.append({
                                        "id": vm.get("vm") or vm.get("vm_id") or vm.get("name", ""),
                                        "name": vm.get("name", ""),
                                        "cluster": vm_cluster_ref,
                                        "host": host_ref,
                                        "ipAddress": vm.get("ipAddress") or "0.0.0.0",
                                        "node": host_ref or "Unassigned",
                                        "status": "Running" if vm.get("power_state") in ("POWERED_ON", "poweredOn") else "Stopped",
                                        "cpu": cpu_v,
                                        "ram": ram_v,
                                        "hdd": hdd_v,
                                        "osAndExpiry": os_v
                                    })
                                if parsed_vms:
                                    vms = parsed_vms
                        except Exception as e:
                            logger.warning(f"Failed live VM retrieval during import for vCenter {vc_id_str}, using snapshot: {e}")
                except Exception as e:
                    logger.error(f"Error fetching live VMs during import for vCenter {vc_id_str}: {e}")

            for vm in vms:
                try:
                    vm_name = (vm.get("name") or vm.get("id") or "").strip()
                    if not vm_name:
                        skipped_count += 1
                        continue

                    raw_ip = str(vm.get("ipAddress") or "").strip()
                    ip_address = raw_ip if raw_ip and raw_ip != "0.0.0.0" else ""

                    raw_node = str(vm.get("node") or vm.get("host") or "").strip()
                    node = raw_node if raw_node else "Unassigned"
                    if raw_node and raw_node.lower() != "unassigned":
                        mapped = vcenter_host_to_node.get(raw_node) or vcenter_host_to_node.get(raw_node.lower())
                        if mapped:
                            node = mapped
                        else:
                            node = node_by_name.get(raw_node.lower(), raw_node)

                    status_str = str(vm.get("status") or "").lower()
                    power_status = "on" if status_str in ("running", "powered_on", "poweredon", "on") else "off"

                    vm_id_val = str(vm.get("id") or "").strip()

                    # Extract CPU, RAM, HDD, OS specs
                    raw_cpu = vm.get("cpu") or vm.get("cpu_count") or vm.get("vCPU") or vm.get("num_cpu") or vm.get("cpuCores") or ""
                    vm_cpu = str(raw_cpu).strip() if raw_cpu and not isinstance(raw_cpu, dict) else ""

                    raw_ram = vm.get("ram") or vm.get("memory_size_MiB") or vm.get("memory_mb") or vm.get("memory") or vm.get("memory_gb") or vm.get("memorySize") or ""
                    if isinstance(raw_ram, (int, float)) and raw_ram > 0:
                        if raw_ram >= 512:
                            vm_ram = f"{round(raw_ram / 1024)} GB" if raw_ram >= 1024 else f"{int(raw_ram)} MB"
                        else:
                            vm_ram = f"{int(raw_ram)} GB"
                    else:
                        vm_ram = str(raw_ram).strip() if not isinstance(raw_ram, dict) else ""

                    raw_hdd = vm.get("hdd") or vm.get("disk_gb") or vm.get("storage") or vm.get("storage_gb") or vm.get("capacity_gb") or vm.get("total_disk") or ""
                    if isinstance(raw_hdd, (int, float)) and raw_hdd > 0:
                        vm_hdd = f"{int(raw_hdd)} GB"
                    else:
                        vm_hdd = str(raw_hdd).strip() if not isinstance(raw_hdd, dict) else ""

                    raw_os = vm.get("osAndExpiry") or vm.get("guest_OS") or vm.get("os") or vm.get("guest_family") or vm.get("guest_fullname") or ""
                    vm_os = str(raw_os).strip()

                    # Link DCM VM and vCenter VM by IP address to fetch hardware, snapshots, and clones
                    vcenter_snaps = []
                    vcenter_clones = []
                    if session_id and ip_address:
                        try:
                            from services.vcenter.inventory_service import vcenter_inventory_service
                            res = await vcenter_inventory_service.get_snapshots_and_clones_by_ip(
                                vc["ipAddress"], session_id, ip_address, vm_name
                            )
                            vcenter_snaps = res.get("snapshots", [])
                            vcenter_clones = res.get("clones", [])
                            vcenter_vm_id = res.get("vcenterVmId") or vm_id_val

                            if vcenter_vm_id:
                                hw = await vcenter_inventory_service.get_vm_hardware_details(vc["ipAddress"], session_id, vcenter_vm_id)
                                if not vm_cpu and hw.get("cpu"): vm_cpu = hw["cpu"]
                                if not vm_ram and hw.get("ram"): vm_ram = hw["ram"]
                                if not vm_hdd and hw.get("hdd"): vm_hdd = hw["hdd"]
                                if not vm_os and hw.get("osAndExpiry"): vm_os = hw["osAndExpiry"]
                        except Exception as e:
                            logger.warning(f"Failed to fetch live vCenter details by IP for {ip_address}: {e}")

                    # Resolve specific cluster for this VM
                    vm_host_ref = str(vm.get("host") or vm.get("node") or "").strip()
                    vm_raw_cluster = vm.get("cluster") or ""
                    if not vm_raw_cluster and vm_host_ref:
                        vm_raw_cluster = vcenter_host_to_cluster.get(vm_host_ref) or vcenter_host_to_cluster.get(vm_host_ref.lower()) or ""

                    vm_cluster_id = ""
                    if vm_raw_cluster and vcenter_cluster_map.get(vm_raw_cluster):
                        vm_cluster_id = vcenter_cluster_map[vm_raw_cluster]
                    elif vm_raw_cluster:
                        db_c = await clusters_col.find_one({
                            "$or": [
                                {"_id": ObjectId(vm_raw_cluster)} if ObjectId.is_valid(vm_raw_cluster) else {"_id": None},
                                {"clusterName": {"$regex": f"^{re.escape(vm_raw_cluster)}$", "$options": "i"}},
                                {"vcenterClusterId": vm_raw_cluster}
                            ]
                        })
                        if db_c:
                            vm_cluster_id = str(db_c["_id"])
                        else:
                            cursor = clusters_col.find({}, {"slNumber": 1})
                            max_sl = 0
                            async for doc in cursor:
                                max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
                            c_name = vm_raw_cluster if not vm_raw_cluster.startswith("domain-") else f"Cluster {vm_raw_cluster}"
                            ins = await clusters_col.insert_one({
                                "slNumber": str(max_sl + 1),
                                "clusterName": c_name,
                                "vcenterClusterId": vm_raw_cluster,
                                "createdBy": current_user.get("sub", "vCenter Import"),
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            })
                            vm_cluster_id = str(ins.inserted_id)

                    if not vm_cluster_id:
                        vm_cluster_id = fallback_cluster_id

                    or_conditions = [
                        {"vmName": {"$regex": f"^{re.escape(vm_name)}$", "$options": "i"}}
                    ]
                    if vm_id_val:
                        or_conditions.append({"vmId": vm_id_val})

                    existing = await collection.find_one({"$or": or_conditions})

                    if existing:
                        update_fields = {}
                        if ip_address and not existing.get("ipAddress"):
                            update_fields["ipAddress"] = ip_address
                        if node and existing.get("node") != node:
                            update_fields["node"] = node
                        if power_status != existing.get("powerStatus"):
                            update_fields["powerStatus"] = power_status
                        if vm_cluster_id and existing.get("clusterId") != vm_cluster_id:
                            update_fields["clusterId"] = vm_cluster_id
                        if vm_cpu and existing.get("cpu") != vm_cpu:
                            update_fields["cpu"] = vm_cpu
                        if vm_ram and existing.get("ram") != vm_ram:
                            update_fields["ram"] = vm_ram
                        if vm_hdd and existing.get("hdd") != vm_hdd:
                            update_fields["hdd"] = vm_hdd
                        if vm_os and existing.get("osAndExpiry") != vm_os:
                            update_fields["osAndExpiry"] = vm_os
                        if vcenter_snaps:
                            update_fields["snapshots"] = vcenter_snaps
                        if vcenter_clones:
                            update_fields["clones"] = vcenter_clones

                        if update_fields:
                            update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
                            await collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
                            updated_count += 1
                    else:
                        max_vm_id += 1
                        final_vm_id = f"VM-{max_vm_id}"
                        new_vm_doc = {
                            "vmId": final_vm_id,
                            "vmName": vm_name,
                            "clusterId": vm_cluster_id,
                            "ipAddress": ip_address,
                            "applications": "",
                            "node": node,
                            "osAndExpiry": vm_os,
                            "backupName": "",
                            "backupNode": "",
                            "backupStorage": "",
                            "backupDatastore": "",
                            "datastore": "",
                            "admin": [],
                            "adminName": "",
                            "adminContact": "",
                            "powerStatus": power_status,
                            "hdd": vm_hdd,
                            "ram": vm_ram,
                            "cpu": vm_cpu,
                            "createdBy": current_user.get("sub", ""),
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        await collection.insert_one(new_vm_doc)
                        inserted_count += 1
                except Exception as e:
                    logger.error(f"Error processing VM '{vm.get('name', 'unknown')}': {e}")
                    skipped_count += 1

        return {
            "message": f"Bulk import complete: {inserted_count} new VMs imported, {updated_count} existing VMs updated." + (f" {skipped_count} skipped." if skipped_count else ""),
            "imported": inserted_count,
            "updated": updated_count,
            "skipped": skipped_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in import_vcenter_vms: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.put("/{id}", response_description="Update VM details", response_model=VMDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "Update Server Details", "Update VMs (Restricted)"]))])
async def update_item(id: str, request: Request, payload: UpdateVMDetailsModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    old_vm = await collection.find_one({"_id": ObjectId(id)})
    if not old_vm:
        raise HTTPException(status_code=404, detail="VM Details not found")
    old_node = old_vm.get("node")

    item_dict = payload.model_dump(exclude_unset=True)

    user_privileges = current_user.get("privileges", [])
    is_admin = current_user.get("isSuperuser", False) or "Create Server Details" in user_privileges or "Update Server Details" in user_privileges
    if not is_admin and "Update VMs (Restricted)" in user_privileges:
        allowed_keys = {"vmName", "ipAddress", "osAndExpiry", "networkType", "applications", "powerStatus", "adminContact", "hdd", "ram", "cpu", "admin", "adminName"}
        item_dict = {k: v for k, v in item_dict.items() if k in allowed_keys}
        if "admin" in item_dict:
            target_username = current_user.get("sub")
            users_col = db.get_collection("users")
            user_doc = await users_col.find_one({"username": target_username})
            allowed_admin_vals = {target_username}
            if user_doc:
                allowed_admin_vals.add(str(user_doc["_id"]))
                if user_doc.get("username"):
                    allowed_admin_vals.add(user_doc["username"])

            new_admins = item_dict["admin"]
            if new_admins:
                if isinstance(new_admins, str):
                    new_admins = [new_admins]
                for ad in new_admins:
                    if ad not in allowed_admin_vals:
                        raise HTTPException(status_code=403, detail="Restricted admins can only assign themselves or leave the admin field unassigned.")

    if len(item_dict) >= 1:
        item_dict["updatedBy"] = current_user.get("sub", "")
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        ip_val = str(item_dict.get("ipAddress") or item_dict.get("ip") or old_vm.get("ipAddress") or "").strip()
        if ip_val.startswith("192.168"):
            item_dict["networkType"] = "internet"
        elif ip_val.startswith("10."):
            item_dict["networkType"] = "intranet"
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            vm_display_name = old_vm.get("vmName") or old_vm.get("applications") or old_vm.get("vmId") or "VM"
            await log_entity_update(request, current_user, "vm", id, vm_display_name, old_vm, item_dict)
            # Sync name/ip changes to monitored_servers and monitoring_status collections
            old_ip = old_vm.get("ipAddress")
            old_name = old_vm.get("vmName") or old_vm.get("vmId")
            new_name = item_dict.get("vmName") or item_dict.get("vmId")
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
    vm_name = vm.get("applications") or vm.get("vmName") or ""
    vm_ip = vm.get("ipAddress")

    # Live sync vCenter snapshots and clones by IP address
    if vm_ip:
        try:
            vcenter_col = db.get_collection("vcenter")
            vc = await vcenter_col.find_one({"status": True})
            if vc and vc.get("ipAddress"):
                from services.vcenter.session_manager import vcenter_session_manager
                from services.vcenter.inventory_service import vcenter_inventory_service
                
                session_id = await vcenter_session_manager.get_session_id(
                    vc["ipAddress"], vc.get("username", ""), vc.get("password", "")
                )
                if session_id:
                    res = await vcenter_inventory_service.get_snapshots_and_clones_by_ip(
                        vc["ipAddress"], session_id, vm_ip, vm_name
                    )
                    vc_snaps = res.get("snapshots", [])
                    vc_clones = res.get("clones", [])
                    updates = {}
                    if vc_snaps: updates["snapshots"] = vc_snaps
                    if vc_clones: updates["clones"] = vc_clones
                    if updates:
                        await collection.update_one({"_id": ObjectId(id)}, {"$set": updates})
                        vm.update(updates)
        except Exception as e:
            logger.debug(f"Live vCenter lookup by IP skipped in history endpoint: {e}")

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
    # 1. Process Request Logs for COMPLETED requests only
    for log in logs_list:
        req_id = log.get("requestId")
        req = req_map.get(req_id)
        if not req:
            continue

        # Only include if request status is Completed or log action indicates completion
        req_status = (req.get("status") or "").lower()
        what_did = log.get("action") or ""
        is_completed_action = any(k in what_did.lower() for k in ["completed", "complete", "approved", "transition (completed)"])
        
        if req_status != "completed" and not is_completed_action:
            continue

        req_type = req.get("requestType") or req.get("category") or "VM Request"
        req_seq_id = req.get("requestId") or "REQ"
        
        who_requested = user_map.get(req.get("createdBy"), req.get("createdBy"))
        who_did = user_map.get(log.get("user"), log.get("user"))
        timestamp = log.get("timestamp")
        
        log_details = log.get("details") or ""
        remarks = log.get("remarks")
        if remarks:
            log_details += f" (Remarks: {remarks})"

        req_details = req.get("details") or {}
        operation_type = req_details.get("operationType")
        
        op_info = ""
        extra_req_details = []
        if req_type == "VM Management" and operation_type:
            op_info = f" [{operation_type}]"
            if operation_type == "Backup":
                if req_details.get("backupName"):
                    extra_req_details.append(f"Backup Name: {req_details.get('backupName')}")
                if req_details.get("backupNode"):
                    extra_req_details.append(f"Backup Node: {req_details.get('backupNode')}")
                if req_details.get("backupStorage"):
                    extra_req_details.append(f"Backup Storage: {req_details.get('backupStorage')}")
                if req_details.get("ip") or req_details.get("ipAddress"):
                    extra_req_details.append(f"IP: {req_details.get('ip') or req_details.get('ipAddress')}")
            elif operation_type == "Migration":
                if req_details.get("migrationNode"):
                    extra_req_details.append(f"Target Node: {req_details.get('migrationNode')}")
                if req_details.get("ip") or req_details.get("ipAddress"):
                    extra_req_details.append(f"IP: {req_details.get('ip') or req_details.get('ipAddress')}")
            elif operation_type == "Resource Upgrade":
                upgrades = []
                if req_details.get("newRam"): upgrades.append(f"RAM: {req_details.get('newRam')}")
                if req_details.get("newHdd"): upgrades.append(f"HDD: {req_details.get('newHdd')}")
                if req_details.get("newCpu"): upgrades.append(f"CPU: {req_details.get('newCpu')}")
                if upgrades:
                    extra_req_details.append(f"Upgrades: {', '.join(upgrades)}")
                if req_details.get("ip") or req_details.get("ipAddress"):
                    extra_req_details.append(f"IP: {req_details.get('ip') or req_details.get('ipAddress')}")
            elif operation_type == "Power":
                if req_details.get("powerStatus"):
                    extra_req_details.append(f"Target Power: {req_details.get('powerStatus')}")
                if req_details.get("ip") or req_details.get("ipAddress"):
                    extra_req_details.append(f"IP: {req_details.get('ip') or req_details.get('ipAddress')}")
            elif operation_type == "Snapshot":
                snap_name = req_details.get("snapshotName") or req_details.get("name")
                if snap_name:
                    extra_req_details.append(f"Snapshot Name: {snap_name}")
                if req_details.get("remarks"):
                    extra_req_details.append(f"Remarks: {req_details.get('remarks')}")
            elif operation_type == "Delete VM":
                if req_details.get("justification"):
                    extra_req_details.append(f"Justification: {req_details.get('justification')}")
            else:
                if req_details.get("ip") or req_details.get("ipAddress"):
                    extra_req_details.append(f"IP: {req_details.get('ip') or req_details.get('ipAddress')}")

        formatted_details = log_details
        if extra_req_details:
            formatted_details = f"{', '.join(extra_req_details)} | {formatted_details}" if formatted_details else ", ".join(extra_req_details)

        history.append({
            "requestId": req_seq_id,
            "requestType": f"{req_type}{op_info}",
            "whoRequested": who_requested,
            "whoDid": who_did,
            "whatDid": "Completed",
            "time": timestamp,
            "details": formatted_details
        })

    # 2. Append Manually Added Clones, Snapshots, Templates to History
    for c in vm.get("clones", []):
        history.append({
            "requestId": "MANUAL",
            "requestType": "Manual Entry [Clone]",
            "whoRequested": c.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whoDid": c.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whatDid": "Added Clone",
            "time": c.get("createdAt") or vm.get("updatedAt") or vm.get("createdAt"),
            "details": f"Clone Name: {c.get('name')}" + (f" | Remarks: {c.get('remarks')}" if c.get('remarks') else "")
        })

    for s in vm.get("snapshots", []):
        history.append({
            "requestId": "MANUAL",
            "requestType": "Manual Entry [Snapshot]",
            "whoRequested": s.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whoDid": s.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whatDid": "Added Snapshot",
            "time": s.get("createdAt") or vm.get("updatedAt") or vm.get("createdAt"),
            "details": f"Snapshot Name: {s.get('name')}" + (f" | Remarks: {s.get('remarks')}" if s.get('remarks') else "")
        })

    for t in vm.get("templates", []):
        history.append({
            "requestId": "MANUAL",
            "requestType": "Manual Entry [Template]",
            "whoRequested": t.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whoDid": t.get("createdBy") or vm.get("updatedBy") or vm.get("createdBy") or "--",
            "whatDid": "Added Template",
            "time": t.get("createdAt") or vm.get("updatedAt") or vm.get("createdAt"),
            "details": f"Template Name: {t.get('name')}" + (f" | Remarks: {t.get('remarks')}" if t.get('remarks') else "")
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
