from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from auth_utils import require_privilege, get_current_user, require_any_privilege
from history_helper import log_entity_update
from fastapi.responses import JSONResponse
from typing import Optional, List
import re
from database import db
from models import NodeModel, CreateNodeModel, UpdateNodeModel, PaginatedNodesModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("nodes")

def clean_int(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    # extract digits
    digits = "".join([c for c in str(value) if c.isdigit()])
    return int(digits) if digits else 0

async def compute_available_resources(node_doc: dict):
    if not node_doc:
        return node_doc
    
    # Enrich node with clusterName
    cluster_id = node_doc.get("clusterId")
    node_id_str = str(node_doc.get("_id", ""))
    cluster_name = None
    clusters_col = db.get_collection("clusters")
    
    if cluster_id:
        c_doc = await clusters_col.find_one({"_id": ObjectId(cluster_id) if ObjectId.is_valid(cluster_id) else cluster_id})
        if c_doc:
            cluster_name = c_doc.get("clusterName")
    
    if not cluster_name and node_id_str:
        c_doc = await clusters_col.find_one({"nodes": {"$in": [node_id_str, ObjectId(node_id_str) if ObjectId.is_valid(node_id_str) else node_id_str]}})
        if c_doc:
            cluster_name = c_doc.get("clusterName")
            if not cluster_id:
                node_doc["clusterId"] = str(c_doc["_id"])
                
    node_doc["clusterName"] = cluster_name or "--"

    vms_collection = db.get_collection("vm_details")
    node_name = node_doc.get("node", "")
    escaped_node_name = re.escape(node_name) if node_name else ""
    # Find VMs matching the exact node name case-insensitively
    cursor = vms_collection.find({"node": {"$regex": f"^{escaped_node_name}$", "$options": "i"}})
    vms = await cursor.to_list(length=None)
    
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    
    for vm in vms:
        used_ram += clean_int(vm.get("ram"))
        used_hdd += clean_int(vm.get("hdd"))
        used_cpu += clean_int(vm.get("cpu"))
        
    total_ram = clean_int(node_doc.get("totalRam"))
    total_hdd = clean_int(node_doc.get("totalHardisk"))
    total_cpu = clean_int(node_doc.get("totalCpu"))
    
    node_doc["availableRam"] = max(0, total_ram - used_ram) if node_doc.get("totalRam") is not None else None
    node_doc["availableHardisk"] = max(0, total_hdd - used_hdd) if node_doc.get("totalHardisk") is not None else None
    node_doc["availableCpu"] = max(0, total_cpu - used_cpu) if node_doc.get("totalCpu") is not None else None
    
    return node_doc

@router.get("/", response_description="List all nodes", response_model=PaginatedNodesModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "Nodes View", "Create Request", "Update Request", "View Request", "Update Node (Restricted)", "Update Storage (Restricted)", "Update Network Device (Restricted)"]))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    clusterId: Optional[str] = Query(None),
    serverModel: Optional[str] = Query(None),
    admin: Optional[str] = Query(None),
    rack: Optional[str] = Query(None),
    os: Optional[str] = Query(None),
    custodian: Optional[str] = Query(None),
    gpu: Optional[str] = Query(None),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    nodeTypeFilter: Optional[str] = Query(None),
    networkType: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not isinstance(admin, str):
        admin = None
    if not isinstance(clusterId, str):
        clusterId = None
    if not isinstance(serverModel, str):
        serverModel = None
    if not isinstance(rack, str):
        rack = None
    if not isinstance(os, str):
        os = None
    if not isinstance(custodian, str):
        custodian = None
    if not isinstance(gpu, str):
        gpu = None
    if not isinstance(nodeTypeFilter, str):
        nodeTypeFilter = None
    if not isinstance(networkType, str):
        networkType = None
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
    if not can_view_all and not admin:
        admin = "my_unassigned"
    
    # Conditions that match records with no admin assigned
    no_admin_conditions = [
        {"admin": None},
        {"admin": ""},
        {"admin": []},
        {"admin": {"$exists": False}}
    ]

    target_username = current_user.get("sub")
    users_col = db.get_collection("users")
    user_doc = await users_col.find_one({"username": target_username})
    target_user_id = str(user_doc["_id"]) if user_doc else None
    user_admin_identifiers = [target_username]
    if target_user_id:
        user_admin_identifiers.append(target_user_id)

    known_ids = set()
    if admin and admin.lower() == "other":
        users_col_adm = db.get_collection("users")
        all_users = await users_col_adm.find({}, {"_id": 1, "username": 1}).to_list(length=None)
        for u in all_users:
            known_ids.add(str(u["_id"]))
            if u.get("username"):
                known_ids.add(u["username"])

    admin_vals = set()
    if admin and admin.lower() not in ("unassigned", "assigned", "my_unassigned", "other"):
        users_col_adm = db.get_collection("users")
        adm_doc = await users_col_adm.find_one({"username": admin})
        if not adm_doc and ObjectId.is_valid(admin):
            adm_doc = await users_col_adm.find_one({"_id": ObjectId(admin)})
        admin_vals.add(admin)
        if adm_doc:
            admin_vals.add(str(adm_doc["_id"]))
            if adm_doc.get("username"):
                admin_vals.add(adm_doc["username"])

    is_superuser = current_user.get("isSuperuser", False)
    has_appliance_all = is_superuser or "View All Server Details" in privs or "View All Network Device" in privs
    has_storage_all = is_superuser or "View All Server Details" in privs or "View All Storage Device" in privs
    has_node_all = is_superuser or "View All Server Details" in privs
    has_physical_all = is_superuser or "View All Server Details" in privs or "Physical Server View" in privs

    def get_category_admin_cond(allow_all: bool) -> dict:
        if allow_all:
            if not admin:
                return {}
            elif admin.lower() == "unassigned":
                return {"$or": no_admin_conditions}
            elif admin.lower() == "assigned":
                return {"admin": {"$in": user_admin_identifiers}}
            elif admin.lower() == "my_unassigned":
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            elif admin.lower() == "other":
                return {
                    "$and": [
                        {"admin": {"$exists": True, "$ne": None, "$ne": "", "$ne": []}},
                        {"admin": {"$nin": list(known_ids)}}
                    ]
                }
            else:
                return {"admin": {"$in": list(admin_vals)}}
        else:
            if not admin:
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            elif admin.lower() == "unassigned":
                return {"$or": no_admin_conditions}
            elif admin.lower() == "assigned":
                return {"admin": {"$in": user_admin_identifiers}}
            elif admin.lower() == "my_unassigned":
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            else:
                return {"admin": {"$in": user_admin_identifiers}}


    if os and os.strip():
        and_conditions.append({"os": {"$regex": re.escape(os.strip()), "$options": "i"}})

    if custodian and custodian.strip():
        and_conditions.append({"custodian": custodian.strip()})

    if gpu and gpu.strip():
        and_conditions.append({"gpu": {"$regex": re.escape(gpu.strip()), "$options": "i"}})
    
    if clusterId:
        cluster_ids_to_match = [clusterId]
        if ObjectId.is_valid(clusterId):
            cluster_ids_to_match.append(ObjectId(clusterId))

        cluster_doc = await db.get_collection("clusters").find_one({"_id": ObjectId(clusterId) if ObjectId.is_valid(clusterId) else clusterId})
        if cluster_doc:
            node_ids = cluster_doc.get("nodes", []) or []
            matched_ids = []
            for nid in node_ids:
                matched_ids.append(str(nid))
                if ObjectId.is_valid(nid):
                    matched_ids.append(ObjectId(nid))
            and_conditions.append({
                "$or": [
                    {"_id": {"$in": matched_ids}},
                    {"clusterId": {"$in": cluster_ids_to_match}}
                ]
            })
        else:
            and_conditions.append({"clusterId": {"$in": cluster_ids_to_match}})
    
    if nodeTypeFilter:
        if nodeTypeFilter.lower() == "appliance":
            and_conditions.append({"isAppliance": True, **get_category_admin_cond(has_appliance_all)})
        elif nodeTypeFilter.lower() == "storage":
            and_conditions.append({"isStorage": True, **get_category_admin_cond(has_storage_all)})
        elif nodeTypeFilter.lower() == "physical":
            and_conditions.append({"isPhysical": True, **get_category_admin_cond(has_physical_all)})
        elif nodeTypeFilter.lower() == "node":
            node_cond = {
                "isAppliance": {"$ne": True},
                "isStorage": {"$ne": True},
                "isPhysical": {"$ne": True},
                **get_category_admin_cond(has_node_all)
            }
            physical_cond = {
                "isPhysical": True,
                **get_category_admin_cond(has_physical_all)
            }
            and_conditions.append({
                "$or": [
                    node_cond,
                    physical_cond
                ]
            })
    else:
        # All Devices
        app_cond = {"isAppliance": True}
        app_admin = get_category_admin_cond(has_appliance_all)
        if app_admin:
            app_cond.update(app_admin)

        store_cond = {"isStorage": True}
        store_admin = get_category_admin_cond(has_storage_all)
        if store_admin:
            store_cond.update(store_admin)

        physical_cond = {"isPhysical": True}
        physical_admin = get_category_admin_cond(has_physical_all)
        if physical_admin:
            physical_cond.update(physical_admin)

        node_cond = {
            "isAppliance": {"$ne": True},
            "isStorage": {"$ne": True},
            "isPhysical": {"$ne": True}
        }
        node_admin = get_category_admin_cond(has_node_all)
        if node_admin:
            node_cond.update(node_admin)

        and_conditions.append({
            "$or": [
                app_cond,
                store_cond,
                physical_cond,
                node_cond
            ]
        })

    if serverModel:
        and_conditions.append({"serverModel": serverModel})
    
    if rack:
        and_conditions.append({"rack": rack})

    if networkType and networkType.strip():
        nt_val = networkType.strip().lower()
        if nt_val == "intranet":
            and_conditions.append({
                "$or": [
                    {"networkType": "intranet"},
                    {"networkType": None},
                    {"networkType": ""},
                    {"networkType": {"$exists": False}}
                ]
            })
        else:
            and_conditions.append({"networkType": nt_val})
    
    if search:
        import re
        escaped_search = re.escape(search)
        and_conditions.append({
            "$or": [
                {"node": {"$regex": escaped_search, "$options": "i"}},
                {"nodeId": {"$regex": escaped_search, "$options": "i"}},
                {"ipAddress": {"$regex": escaped_search, "$options": "i"}},
                {"ip": {"$regex": escaped_search, "$options": "i"}},
                {"managementIp": {"$regex": escaped_search, "$options": "i"}},
                {"custodian": {"$regex": escaped_search, "$options": "i"}},
                {"admin": {"$regex": escaped_search, "$options": "i"}},
                {"assetNumber": {"$regex": escaped_search, "$options": "i"}},
                {"serialNumber": {"$regex": escaped_search, "$options": "i"}},
                {"serverModel": {"$regex": escaped_search, "$options": "i"}},
                {"rack": {"$regex": escaped_search, "$options": "i"}},
                {"rackPosition": {"$regex": escaped_search, "$options": "i"}},
                {"remarks": {"$regex": escaped_search, "$options": "i"}}
            ]
        })

    query = {"$and": and_conditions} if len(and_conditions) > 1 else (and_conditions[0] if and_conditions else {})

    nodes_cursor = collection.find(query)
    nodes_list = await nodes_cursor.to_list(length=None)
    
    merged_items = [dict(item) for item in nodes_list]
    
    physical_query = None
    if not nodeTypeFilter or nodeTypeFilter.lower() in ("physical", "node"):
        physical_and = []
        if not has_physical_all:
            physical_and.append({
                "$or": [
                    {"admin": {"$in": user_admin_identifiers}},
                    *no_admin_conditions
                ]
            })
        else:
            if admin:
                if admin.lower() == "unassigned":
                    physical_and.append({"$or": no_admin_conditions})
                elif admin.lower() == "my_unassigned":
                    physical_and.append({
                        "$or": [
                            {"admin": {"$in": user_admin_identifiers}},
                            *no_admin_conditions
                        ]
                    })
                elif admin.lower() == "assigned":
                    physical_and.append({"admin": {"$in": user_admin_identifiers}})
                elif admin.lower() == "other":
                    users_col_adm = db.get_collection("users")
                    all_users = await users_col_adm.find({}, {"_id": 1, "username": 1}).to_list(length=None)
                    known_ids = set()
                    for u in all_users:
                        known_ids.add(str(u["_id"]))
                        if u.get("username"):
                            known_ids.add(u["username"])
                    physical_and.append({
                        "$and": [
                            {"admin": {"$exists": True, "$ne": None, "$ne": "", "$ne": []}},
                            {"admin": {"$nin": list(known_ids)}}
                        ]
                    })
                else:
                    physical_and.append({"admin": {"$in": list(admin_vals)}})
                    
        if clusterId:
            physical_and.append({"clusterId": clusterId})
            
        if serverModel:
            physical_and.append({"serverModel": serverModel})
            
        if search:
            import re
            escaped_search = re.escape(search)
            physical_and.append({
                "$or": [
                    {"node": {"$regex": escaped_search, "$options": "i"}},
                    {"ipAddress": {"$regex": escaped_search, "$options": "i"}},
                    {"applications": {"$regex": escaped_search, "$options": "i"}},
                    {"ram": {"$regex": escaped_search, "$options": "i"}},
                    {"hdd": {"$regex": escaped_search, "$options": "i"}},
                    {"cpu": {"$regex": escaped_search, "$options": "i"}},
                    {"backupLocation": {"$regex": escaped_search, "$options": "i"}},
                    {"remarks": {"$regex": escaped_search, "$options": "i"}}
                ]
            })
            
        physical_query = {"$and": physical_and} if len(physical_and) > 1 else (physical_and[0] if physical_and else {})

    if physical_query is not None:
        ps_col = db.get_collection("physical_servers")
        ps_cursor = ps_col.find(physical_query)
        ps_list = await ps_cursor.to_list(length=None)
        for ps in ps_list:
            node_doc = {
                "_id": ps["_id"],
                "nodeId": ps.get("nodeId") or f"PS-{str(ps['_id'])[-5:]}",
                "node": ps.get("node"),
                "totalRam": ps.get("ram"),
                "totalHardisk": ps.get("hdd"),
                "totalCpu": ps.get("cpu"),
                "clusterId": ps.get("clusterId"),
                "admin": ps.get("admin"),
                "ip": ps.get("ipAddress"),
                "isAppliance": False,
                "isStorage": False,
                "isPhysical": True,
                "os": ps.get("osAndExpiry"),
                "remarks": ps.get("remarks") or ps.get("backupLocation") or "",
                "createdBy": ps.get("createdBy"),
                "createdAt": ps.get("createdAt"),
                "updatedBy": ps.get("updatedBy"),
                "updatedAt": ps.get("updatedAt")
            }
            merged_items.append(node_doc)

    sort_key = sortBy or sort_by or "nodeId"
    reverse = (order == "desc")
    
    def get_sort_val(item):
        val = item.get(sort_key)
        if val is None:
            # Fallbacks for physical server specific keys
            if sort_key == "totalRam":
                val = item.get("ram")
            elif sort_key == "totalHardisk":
                val = item.get("hdd")
            elif sort_key == "totalCpu":
                val = item.get("cpu")
            elif sort_key == "ip":
                val = item.get("ipAddress")
                
        if val is None:
            return ""
        if isinstance(val, (int, float)):
            return val
        if isinstance(val, str):
            val_strip = val.strip().lower()
            digits = "".join([c for c in val_strip if c.isdigit() or c == "."])
            if digits:
                try:
                    return float(digits)
                except ValueError:
                    pass
            return val_strip
        return str(val).lower()
        
    merged_items.sort(key=get_sort_val, reverse=reverse)
    
    total = len(merged_items)
    
    if pagination:
        paginated_items = merged_items[skip:skip + limit]
    else:
        paginated_items = merged_items

    items = [await compute_available_resources(item) for item in paginated_items]

    return {"data": items, "total": total}

@router.post("/", response_description="Create a node", response_model=NodeModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateNodeModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if payload.ip:
        import re
        ip_parts = [ip.strip() for ip in payload.ip.split(",") if ip.strip()]
        for ip_part in ip_parts:
            escaped_ip = re.escape(ip_part)
            pattern = rf"(^|,)\s*{escaped_ip}\s*(,|$)"
            existing_ip = await collection.find_one({"ip": {"$regex": pattern}})
            if existing_ip:
                raise HTTPException(status_code=400, detail=f"IP address {ip_part} already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    max_node_id = 0
    cursor = collection.find({}, {"nodeId": 1})
    async for doc in cursor:
        nid = str(doc.get("nodeId", ""))
        digits = "".join(c for c in nid if c.isdigit())
        if digits:
            try:
                max_node_id = max(max_node_id, int(digits))
            except:
                pass
    item_dict["nodeId"] = f"{max_node_id + 1:03d}"

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return await compute_available_resources(created)

@router.put("/{id}", response_description="Update a node", response_model=NodeModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "Update Server Details", "Update Node (Restricted)", "Update Storage (Restricted)", "Update Network Device (Restricted)"]))])
async def update_item(id: str, request: Request, payload: UpdateNodeModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    # Fetch the old node document before updating (to get old IP for monitoring sync)
    old_doc = await collection.find_one({"_id": ObjectId(id)})
    if not old_doc:
        raise HTTPException(status_code=404, detail=f"Node {id} not found")

    item_dict = payload.model_dump(exclude_unset=True)

    user_privileges = current_user.get("privileges", [])
    is_admin = current_user.get("isSuperuser", False) or "Create Server Details" in user_privileges or "Update Server Details" in user_privileges

    if not is_admin:
        is_storage = old_doc.get("isStorage", False) or item_dict.get("isStorage", False)
        is_appliance = old_doc.get("isAppliance", False) or item_dict.get("isAppliance", False)

        has_node_res = "Update Node (Restricted)" in user_privileges
        has_storage_res = "Update Storage (Restricted)" in user_privileges
        has_net_res = "Update Network Device (Restricted)" in user_privileges

        if (is_storage and has_storage_res) or (is_appliance and has_net_res) or (not is_storage and not is_appliance and has_node_res):
            allowed_keys = {"node", "ip", "os", "networkType", "totalRam", "totalHardisk", "totalCpu", "gpu", "remarks", "admin"}
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
        if "ip" in item_dict and item_dict["ip"]:
            import re
            ip_parts = [ip.strip() for ip in item_dict["ip"].split(",") if ip.strip()]
            for ip_part in ip_parts:
                escaped_ip = re.escape(ip_part)
                pattern = rf"(^|,)\s*{escaped_ip}\s*(,|$)"
                existing_ip = await collection.find_one({
                    "ip": {"$regex": pattern},
                    "_id": {"$ne": ObjectId(id)}
                })
                if existing_ip:
                    raise HTTPException(status_code=400, detail=f"IP address {ip_part} already exists")

        item_dict["updatedBy"] = current_user.get("sub", "")
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        # Sync name/ip changes to monitored_servers and monitoring_status collections
        if update_result.modified_count == 1:
            is_storage = old_doc.get("isStorage", False)
            is_appliance = old_doc.get("isAppliance", False)
            is_physical = old_doc.get("isPhysicalServer", False)
            entity_type = "storage_device" if is_storage else ("network_device" if is_appliance else ("physical_server" if is_physical else "node"))
            node_display_name = old_doc.get("node") or old_doc.get("ip") or "Node"
            await log_entity_update(request, current_user, entity_type, id, node_display_name, old_doc, item_dict)
            old_ip = old_doc.get("ip")
            old_name = old_doc.get("node")
            new_name = item_dict.get("node")
            new_ip = item_dict.get("ip")

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
                return await compute_available_resources(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return await compute_available_resources(existing)

    raise HTTPException(status_code=404, detail=f"Node {id} not found")

@router.delete("/{id}", response_description="Delete a node", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        # Remove this node from any cluster's nodes list
        clusters_col = db.get_collection("clusters")
        await clusters_col.update_many(
            {"nodes": id},
            {"$pull": {"nodes": id}}
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Node {id} not found")
