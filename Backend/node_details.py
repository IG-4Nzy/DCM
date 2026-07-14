from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import NodeDetailsModel, CreateNodeDetailsModel, UpdateNodeDetailsModel, PaginatedNodeDetailsModel
from bson import ObjectId
from datetime import datetime, timezone
import openpyxl
import io
import csv

router = APIRouter()
collection = db.get_collection("node_details")

def clean_int(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join([c for c in str(value) if c.isdigit()])
    return int(digits) if digits else 0

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

async def compute_node_details_available_resources(doc: dict):
    if not doc:
        return doc
    vms_collection = db.get_collection("vm_details")
    node_name = doc.get("hostName", "")
    
    # Find VMs matching this hostName case-insensitively
    cursor = vms_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    vms = await cursor.to_list(length=None)
    
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    
    for vm in vms:
        used_ram += clean_int(vm.get("ram"))
        used_hdd += clean_int(vm.get("hdd"))
        used_cpu += clean_int(vm.get("cpu"))
        
    total_ram = clean_int(doc.get("totalRam"))
    total_hdd = clean_int(doc.get("totalHardisk"))
    total_cpu = clean_int(doc.get("totalCpu"))
    
    doc["availableRam"] = max(0, total_ram - used_ram) if doc.get("totalRam") is not None else None
    doc["availableHardisk"] = max(0, total_hdd - used_hdd) if doc.get("totalHardisk") is not None else None
    doc["availableCpu"] = max(0, total_cpu - used_cpu) if doc.get("totalCpu") is not None else None
    
    return doc

@router.get("/", response_description="List all node details", response_model=PaginatedNodeDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "Nodes View", "Create Request", "Update Request", "View Request"]))])
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    privs = current_user.get("privileges", [])
    can_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs or "Create Server Details" in privs or "Create Request" in privs or "Update Request" in privs or "View Request" in privs
    if not can_view_all:
        target_username = current_user.get("sub")
        users_col = db.get_collection("users")
        user_doc = await users_col.find_one({"username": target_username})
        target_user_id = str(user_doc["_id"]) if user_doc else None
        admin_conditions = [{"admin": target_username}]
        if target_user_id:
            admin_conditions.append({"admin": target_user_id})
        query["$or"] = admin_conditions
    
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
                numeric_match = []
                try:
                    num_val = int(term)
                    numeric_match = [
                        {"totalRam": num_val},
                        {"totalHardisk": num_val},
                        {"totalCpu": num_val},
                        {"availableRam": num_val},
                        {"availableHardisk": num_val},
                        {"availableCpu": num_val},
                    ]
                except ValueError:
                    pass
                
                resource_str_queries = [
                    {"totalRam": {"$regex": escaped_term, "$options": "i"}},
                    {"totalHardisk": {"$regex": escaped_term, "$options": "i"}},
                    {"totalCpu": {"$regex": escaped_term, "$options": "i"}},
                    {"availableRam": {"$regex": escaped_term, "$options": "i"}},
                    {"availableHardisk": {"$regex": escaped_term, "$options": "i"}},
                    {"availableCpu": {"$regex": escaped_term, "$options": "i"}},
                ]

                or_conditions = [
                    {"hostName": {"$regex": escaped_term, "$options": "i"}},
                    {"ipAddress": {"$regex": escaped_term, "$options": "i"}},
                    {"rack": {"$regex": escaped_term, "$options": "i"}},
                    {"serverModel": {"$regex": escaped_term, "$options": "i"}},
                    {"serialNumber": {"$regex": escaped_term, "$options": "i"}},
                    {"admin": {"$regex": escaped_term, "$options": "i"}},
                    {"adminCode": {"$regex": escaped_term, "$options": "i"}},
                    {"hypervisor": {"$regex": escaped_term, "$options": "i"}},
                    {"applications": {"$regex": escaped_term, "$options": "i"}},
                    {"clusterType": {"$regex": escaped_term, "$options": "i"}},
                    {"indentor": {"$regex": escaped_term, "$options": "i"}},
                    {"poNum": {"$regex": escaped_term, "$options": "i"}},
                    {"assetNum": {"$regex": escaped_term, "$options": "i"}},
                    {"custodian": {"$regex": escaped_term, "$options": "i"}},
                    {"redundancyPower": {"$regex": escaped_term, "$options": "i"}},
                    {"remarks": {"$regex": escaped_term, "$options": "i"}},
                    {"slNumber": {"$regex": escaped_term, "$options": "i"}},
                    {"nodeId": {"$regex": escaped_term, "$options": "i"}},
                    {"createdBy": {"$regex": escaped_term, "$options": "i"}},
                    {"updatedAt": {"$regex": escaped_term, "$options": "i"}},
                ] + numeric_match + resource_str_queries

                if matching_cluster_ids:
                    or_conditions.append({"clusterId": {"$in": matching_cluster_ids}})

                term_queries.append({"$or": or_conditions})
            query["$and"] = term_queries

    actual_sort_by = sortBy or sort_by or "slNumber"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)

    if actual_sort_by == "slNumber":
        pipeline = [
            {"$match": query},
            {
                "$addFields": {
                    "_slNumberSort": {
                        "$convert": {
                            "input": "$slNumber",
                            "to": "int",
                            "onError": 0,
                            "onNull": 0,
                        }
                    }
                }
            },
            {"$sort": {"_slNumberSort": sort_order}},
        ]
        if pagination:
            pipeline.extend([{"$skip": skip}, {"$limit": limit}])
        pipeline.append({"$project": {"_slNumberSort": 0}})
        items = await collection.aggregate(pipeline).to_list(length=limit if pagination else None)
    else:
        cursor = collection.find(query).sort(actual_sort_by, sort_order)
        if pagination:
            cursor = cursor.skip(skip).limit(limit)
            items = await cursor.to_list(length=limit)
        else:
            items = await cursor.to_list(length=None)

    items = [await compute_node_details_available_resources(item) for item in items]

    return {"data": items, "total": total}

@router.post("/", response_description="Create node details", response_model=NodeDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateNodeDetailsModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await collection.find_one({"hostName": {"$regex": f"^{payload.hostName}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Node with hostname '{payload.hostName}' already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Auto-populate SL Number safely
    cursor = collection.find({"clusterId": payload.clusterId}, {"slNumber": 1})
    max_sl = 0
    async for doc in cursor:
        max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
    
    item_dict["slNumber"] = str(max_sl + 1)
    
    max_node_id = 0
    nodes_collection = db.get_collection("nodes")
    cursor = nodes_collection.find({"nodeId": {"$regex": "^NODE-"}}, {"nodeId": 1})
    async for doc in cursor:
        nid = doc.get("nodeId", "")
        if nid.startswith("NODE-"):
            try:
                num = int(nid.replace("NODE-", ""))
                max_node_id = max(max_node_id, num)
            except:
                pass
    item_dict["nodeId"] = f"NODE-{max_node_id + 1:02d}"

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})

    # Synchronize node into the global nodes collection
    host_name = item_dict.get("hostName")
    if host_name:
        nodes_collection = db.get_collection("nodes")
        existing_node = await nodes_collection.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
        node_payload = {
            "node": host_name,
            "nodeId": item_dict.get("nodeId"),
            "remarks": item_dict.get("remarks", ""),
            "totalRam": item_dict.get("totalRam"),
            "totalHardisk": item_dict.get("totalHardisk"),
            "totalCpu": item_dict.get("totalCpu"),
            "createdBy": current_user.get("sub", ""),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        if existing_node:
            await nodes_collection.update_one(
                {"_id": existing_node["_id"]},
                {"$set": {
                    "nodeId": item_dict.get("nodeId"),
                    "totalRam": item_dict.get("totalRam"),
                    "totalHardisk": item_dict.get("totalHardisk"),
                    "totalCpu": item_dict.get("totalCpu"),
                    "remarks": item_dict.get("remarks", ""),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await nodes_collection.insert_one(node_payload)

    return await compute_node_details_available_resources(created)

@router.put("/{id}", response_description="Update node details", response_model=NodeDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdateNodeDetailsModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if "hostName" in item_dict:
        existing = await collection.find_one({
            "hostName": {"$regex": f"^{item_dict['hostName']}$", "$options": "i"},
            "_id": {"$ne": ObjectId(id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Node with hostname '{item_dict['hostName']}' already exists")

    if len(item_dict) >= 1:
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            updated = await collection.find_one({"_id": ObjectId(id)})
            if updated is not None:
                # Synchronize node into the global nodes collection
                host_name = updated.get("hostName")
                if host_name:
                    nodes_collection = db.get_collection("nodes")
                    existing_node = await nodes_collection.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
                    if existing_node:
                        await nodes_collection.update_one(
                            {"_id": existing_node["_id"]},
                            {"$set": {
                                "totalRam": updated.get("totalRam"),
                                "totalHardisk": updated.get("totalHardisk"),
                                "totalCpu": updated.get("totalCpu"),
                                "remarks": updated.get("remarks", ""),
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                    else:
                        node_payload = {
                            "node": host_name,
                            "remarks": updated.get("remarks", ""),
                            "totalRam": updated.get("totalRam"),
                            "totalHardisk": updated.get("totalHardisk"),
                            "totalCpu": updated.get("totalCpu"),
                            "createdBy": "system",
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        await nodes_collection.insert_one(node_payload)
                return await compute_node_details_available_resources(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return await compute_node_details_available_resources(existing)

    raise HTTPException(status_code=404, detail="Node details not found")

@router.delete("/{id}", response_description="Delete node details", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Node details not found")

@router.post("/bulk", response_description="Bulk create node details", dependencies=[Depends(require_privilege("Create Server Details"))])
async def bulk_create_node_details(
    clusterId: str = Query(..., description="The ID of the cluster"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    username = current_user.get("sub", "Unknown")
    
    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are supported")
        
    content = await file.read()
    items_to_insert = []
    
    cursor = collection.find({"clusterId": clusterId}, {"slNumber": 1})
    max_sl = 0
    async for doc in cursor:
        max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
            
    next_sl = max_sl + 1
    current_time = datetime.now(timezone.utc).isoformat()
    
    nodes_collection = db.get_collection("nodes")
    max_node_id = 0
    node_id_cursor = nodes_collection.find({"nodeId": {"$regex": "^NODE-"}}, {"nodeId": 1})
    async for doc in node_id_cursor:
        nid = doc.get("nodeId", "")
        if nid.startswith("NODE-"):
            try:
                num = int(nid.replace("NODE-", ""))
                max_node_id = max(max_node_id, num)
            except:
                pass
    next_node_id = max_node_id + 1
    
    try:
        if file.filename.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file is empty or missing headers")
            
            headers = [str(h).lower().strip() for h in rows[0]]
        else:
            decoded = content.decode("utf-8")
            reader = csv.reader(decoded.splitlines())
            rows = list(reader)
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")
            
            headers = [str(h).lower().strip() for h in rows[0]]
            
        def find_idx(sub_strings):
            for sub in sub_strings:
                idx = next((i for i, h in enumerate(headers) if sub in h), -1)
                if idx != -1:
                    return idx
            return -1

        rack_idx = find_idx(["rack"])
        hostname_idx = find_idx(["hostname", "host name", "host"])
        ip_idx = find_idx(["ipaddress", "ip address", "ip"])
        model_idx = find_idx(["servermodel", "server model", "model"])
        serial_idx = find_idx(["serialnumber", "serial number", "serial", "sn"])
        admin_idx = find_idx(["admin"])
        hypervisor_idx = find_idx(["hypervisor"])
        apps_idx = find_idx(["applications", "apps", "app"])
        type_idx = find_idx(["clustertype", "cluster type", "type"])
        indentor_idx = find_idx(["indentor"])
        po_idx = find_idx(["ponum", "po num", "po number", "po"])
        asset_idx = find_idx(["assetnum", "asset num", "asset number", "asset"])
        custodian_idx = find_idx(["custodian"])
        redundancy_idx = find_idx(["redundancypower", "redundancy power", "redundant power"])
        ram_idx = find_idx(["totalram", "total ram", "ram"])
        hdd_idx = find_idx(["totalhardisk", "total hardisk", "total hdd", "hdd", "hardisk"])
        cpu_idx = find_idx(["totalcpu", "total cpu", "cpu", "cores"])
        remarks_idx = find_idx(["remarks", "remark"])
        
        seen_hosts = set()
        for row in rows[1:]:
            if not row or (hostname_idx != -1 and len(row) <= hostname_idx):
                continue
            
            hostname_val = str(row[hostname_idx]).strip() if hostname_idx != -1 and row[hostname_idx] is not None else ""
            if not hostname_val:
                continue
            
            host_lower = hostname_val.lower()
            if host_lower in seen_hosts:
                raise HTTPException(status_code=400, detail=f"Duplicate hostname '{hostname_val}' found in the file")
            seen_hosts.add(host_lower)
            
            existing = await collection.find_one({"hostName": {"$regex": f"^{hostname_val}$", "$options": "i"}})
            if existing:
                raise HTTPException(status_code=400, detail=f"Node with hostname '{hostname_val}' already exists")

            rack_val = str(row[rack_idx]).strip() if rack_idx != -1 and len(row) > rack_idx and row[rack_idx] is not None else ""
            ip_val = str(row[ip_idx]).strip() if ip_idx != -1 and len(row) > ip_idx and row[ip_idx] is not None else ""
            model_val = str(row[model_idx]).strip() if model_idx != -1 and len(row) > model_idx and row[model_idx] is not None else ""
            serial_val = str(row[serial_idx]).strip() if serial_idx != -1 and len(row) > serial_idx and row[serial_idx] is not None else ""
            admin_val = str(row[admin_idx]).strip() if admin_idx != -1 and len(row) > admin_idx and row[admin_idx] is not None else ""
            hypervisor_val = str(row[hypervisor_idx]).strip() if hypervisor_idx != -1 and len(row) > hypervisor_idx and row[hypervisor_idx] is not None else ""
            apps_val = str(row[apps_idx]).strip() if apps_idx != -1 and len(row) > apps_idx and row[apps_idx] is not None else ""
            type_val = str(row[type_idx]).strip() if type_idx != -1 and len(row) > type_idx and row[type_idx] is not None else ""
            indentor_val = str(row[indentor_idx]).strip() if indentor_idx != -1 and len(row) > indentor_idx and row[indentor_idx] is not None else ""
            po_val = str(row[po_idx]).strip() if po_idx != -1 and len(row) > po_idx and row[po_idx] is not None else ""
            asset_val = str(row[asset_idx]).strip() if asset_idx != -1 and len(row) > asset_idx and row[asset_idx] is not None else ""
            custodian_val = str(row[custodian_idx]).strip() if custodian_idx != -1 and len(row) > custodian_idx and row[custodian_idx] is not None else ""
            
            redundancy_val = "No"
            if redundancy_idx != -1 and len(row) > redundancy_idx and row[redundancy_idx] is not None:
                r_val = str(row[redundancy_idx]).strip().lower()
                if r_val in ("yes", "true", "1"):
                    redundancy_val = "Yes"
            
            def parse_int_safe(val):
                if val is None:
                    return None
                try:
                    return int(float(str(val).strip()))
                except (ValueError, TypeError):
                    return None
            
            ram_val = parse_int_safe(row[ram_idx]) if ram_idx != -1 and len(row) > ram_idx else None
            hdd_val = parse_int_safe(row[hdd_idx]) if hdd_idx != -1 and len(row) > hdd_idx else None
            cpu_val = parse_int_safe(row[cpu_idx]) if cpu_idx != -1 and len(row) > cpu_idx else None
            remarks_val = str(row[remarks_idx]).strip() if remarks_idx != -1 and len(row) > remarks_idx and row[remarks_idx] is not None else ""
            
            admin_code = "--"
            if admin_val:
                users_collection = db.get_collection("users")
                user_doc = await users_collection.find_one({"username": {"$regex": f"^{admin_val}$", "$options": "i"}})
                if user_doc:
                    admin_code = user_doc.get("passnumber") or user_doc.get("passNumber") or "--"
                    admin_val = user_doc.get("username")

            node_dict = {
                "clusterId": clusterId,
                "slNumber": str(next_sl),
                "nodeId": f"NODE-{next_node_id:02d}",
                "rack": rack_val,
                "hostName": hostname_val,
                "ipAddress": ip_val,
                "serverModel": model_val,
                "serialNumber": serial_val,
                "admin": admin_val,
                "adminCode": admin_code,
                "hypervisor": hypervisor_val,
                "applications": apps_val,
                "clusterType": type_val,
                "indentor": indentor_val,
                "poNum": po_val,
                "assetNum": asset_val,
                "custodian": custodian_val,
                "redundancyPower": redundancy_val,
                "totalRam": ram_val,
                "totalHardisk": hdd_val,
                "totalCpu": cpu_val,
                "remarks": remarks_val,
                "createdBy": username,
                "updatedAt": current_time
            }
            
            items_to_insert.append(node_dict)
            next_sl += 1
            next_node_id += 1
            
        if items_to_insert:
            await collection.insert_many(items_to_insert)
            
            # Synchronize nodes into the global nodes collection
            nodes_collection = db.get_collection("nodes")
            for item in items_to_insert:
                host_name = item.get("hostName")
                if host_name:
                    existing_node = await nodes_collection.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
                    node_payload = {
                        "node": host_name,
                        "nodeId": item.get("nodeId"),
                        "remarks": item.get("remarks", ""),
                        "totalRam": item.get("totalRam"),
                        "totalHardisk": item.get("totalHardisk"),
                        "totalCpu": item.get("totalCpu"),
                        "createdBy": username,
                        "updatedAt": current_time
                    }
                    if existing_node:
                        await nodes_collection.update_one(
                            {"_id": existing_node["_id"]},
                            {"$set": {
                                "nodeId": item.get("nodeId"),
                                "totalRam": item.get("totalRam"),
                                "totalHardisk": item.get("totalHardisk"),
                                "totalCpu": item.get("totalCpu"),
                                "remarks": item.get("remarks", ""),
                                "updatedAt": current_time
                            }}
                        )
                    else:
                        await nodes_collection.insert_one(node_payload)
                        
        return {"message": f"Successfully created {len(items_to_insert)} node details"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
