from database import db
from bson import ObjectId

async def resolve_search_references(search: str):
    matched_user_identifiers = []
    matched_cluster_ids = []
    matched_node_names = []
    
    if not search:
        return matched_user_identifiers, matched_cluster_ids, matched_node_names
        
    search_lower = search.strip().lower()
    
    # 1. Resolve Users / Admins
    try:
        users_col = db.get_collection("users")
        user_cursor = users_col.find({}, {"_id": 1, "firstName": 1, "lastName": 1, "username": 1})
        async for u in user_cursor:
            full_name = f"{u.get('firstName') or ''} {u.get('lastName') or ''}".strip()
            uname = u.get("username") or ""
            uid = str(u["_id"])
            if (search_lower in full_name.lower() or 
                search_lower in uname.lower() or 
                search_lower == uid.lower()):
                matched_user_identifiers.append(uid)
                matched_user_identifiers.append(uname)
                if ObjectId.is_valid(uid):
                    matched_user_identifiers.append(ObjectId(uid))
    except Exception as e:
        print(f"Error resolving users for search: {e}")

    # 2. Resolve Clusters
    try:
        clusters_col = db.get_collection("clusters")
        cluster_cursor = clusters_col.find({}, {"_id": 1, "clusterName": 1, "nodes": 1})
        async for c in cluster_cursor:
            cname = c.get("clusterName") or ""
            cid = str(c["_id"])
            if (search_lower in cname.lower() or 
                search_lower == cid.lower()):
                matched_cluster_ids.append(cid)
                if ObjectId.is_valid(cid):
                    matched_cluster_ids.append(ObjectId(cid))
                # Collect the node names/IDs in this cluster as well
                nodes_in_cluster = c.get("nodes") or []
                for node_id in nodes_in_cluster:
                    matched_node_names.append(str(node_id))
                    if ObjectId.is_valid(node_id):
                        matched_node_names.append(ObjectId(node_id))
    except Exception as e:
        print(f"Error resolving clusters for search: {e}")

    matched_ips = []
    
    # 3. Resolve IPs from ip_list
    try:
        ip_list_col = db.get_collection("ip_list")
        ip_cursor = ip_list_col.find({}, {"ip": 1, "purpose": 1})
        async for item in ip_cursor:
            ip_addr = item.get("ip") or ""
            purpose = item.get("purpose") or ""
            if search_lower in ip_addr.lower() or search_lower in purpose.lower():
                matched_ips.append(ip_addr)
    except Exception as e:
        print(f"Error resolving ip list for search: {e}")
        
    return matched_user_identifiers, matched_cluster_ids, matched_node_names, matched_ips
