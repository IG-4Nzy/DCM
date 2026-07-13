"""
One-time migration script to assign nodeId (NODE-01, NODE-02...) 
and vmId (VM-01, VM-02...) to existing records that don't have them.

Run with:  python migrate_ids.py
"""
import asyncio
from database import db


async def migrate():
    # ── Nodes (global nodes collection) ──
    nodes_col = db.get_collection("nodes")
    cursor = nodes_col.find({"$or": [{"nodeId": {"$exists": False}}, {"nodeId": None}, {"nodeId": ""}]})
    nodes = await cursor.to_list(length=None)

    # Find current max
    max_node = 0
    existing_cursor = nodes_col.find({"nodeId": {"$regex": "^NODE-"}}, {"nodeId": 1})
    async for doc in existing_cursor:
        nid = doc.get("nodeId", "")
        if nid.startswith("NODE-"):
            try:
                max_node = max(max_node, int(nid.replace("NODE-", "")))
            except:
                pass

    count_nodes = 0
    for node in nodes:
        max_node += 1
        await nodes_col.update_one(
            {"_id": node["_id"]},
            {"$set": {"nodeId": f"NODE-{max_node:02d}"}}
        )
        count_nodes += 1
    print(f"Assigned nodeId to {count_nodes} nodes (global)")

    # ── Node Details ──
    nd_col = db.get_collection("node_details")
    nd_cursor = nd_col.find({"$or": [{"nodeId": {"$exists": False}}, {"nodeId": None}, {"nodeId": ""}]})
    nd_docs = await nd_cursor.to_list(length=None)

    count_nd = 0
    for nd in nd_docs:
        host_name = nd.get("hostName", "")
        # Try to find matching node in global collection to reuse nodeId
        if host_name:
            global_node = await nodes_col.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
            if global_node and global_node.get("nodeId"):
                node_id = global_node["nodeId"]
            else:
                max_node += 1
                node_id = f"NODE-{max_node:02d}"
        else:
            max_node += 1
            node_id = f"NODE-{max_node:02d}"

        await nd_col.update_one(
            {"_id": nd["_id"]},
            {"$set": {"nodeId": node_id}}
        )
        count_nd += 1
    print(f"Assigned nodeId to {count_nd} node_details")

    # ── VM Details ──
    vm_col = db.get_collection("vm_details")
    vm_cursor = vm_col.find({"$or": [{"vmId": {"$exists": False}}, {"vmId": None}, {"vmId": ""}]})
    vms = await vm_cursor.to_list(length=None)

    max_vm = 0
    existing_vm_cursor = vm_col.find({"vmId": {"$regex": "^VM-"}}, {"vmId": 1})
    async for doc in existing_vm_cursor:
        vid = doc.get("vmId", "")
        if vid.startswith("VM-"):
            try:
                max_vm = max(max_vm, int(vid.replace("VM-", "")))
            except:
                pass

    count_vms = 0
    for vm in vms:
        max_vm += 1
        await vm_col.update_one(
            {"_id": vm["_id"]},
            {"$set": {"vmId": f"VM-{max_vm:02d}"}}
        )
        count_vms += 1
    print(f"Assigned vmId to {count_vms} vm_details")

    print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
