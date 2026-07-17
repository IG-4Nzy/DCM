"""
Migration Script: Move node-to-cluster relationship from nodes.clusterId to clusters.nodes[]

This script reads all nodes that have a non-empty `clusterId` field and populates
the corresponding cluster document's `nodes` array with those node IDs.

After running this migration, the cluster↔node relationship is managed from the
cluster side (cluster.nodes[]) while nodes.clusterId is kept in sync automatically
by the updated clusters.py endpoints.

Safe to run multiple times — it uses $addToSet to avoid duplicates.
"""

import asyncio
from database import db
from bson import ObjectId

async def migrate():
    nodes_col = db.get_collection("nodes")
    clusters_col = db.get_collection("clusters")

    print("Starting migration: nodes.clusterId → clusters.nodes[]")
    print("=" * 60)

    # Step 1: List all clusters
    clusters = await clusters_col.find({}).to_list(length=None)
    cluster_map = {}
    for c in clusters:
        cid = str(c["_id"])
        cluster_map[cid] = c.get("clusterName", cid)
        # Ensure nodes field exists
        if "nodes" not in c:
            await clusters_col.update_one(
                {"_id": c["_id"]},
                {"$set": {"nodes": []}}
            )

    print(f"Found {len(clusters)} clusters:")
    for cid, name in cluster_map.items():
        print(f"  {name} -> {cid}")

    # Step 2: Find all nodes with a clusterId set
    nodes = await nodes_col.find(
        {"clusterId": {"$exists": True, "$ne": "", "$ne": None}}
    ).to_list(length=None)

    print(f"\nFound {len(nodes)} nodes with a clusterId set.")

    updated_clusters = 0
    skipped = 0
    warnings = []

    for node in nodes:
        node_id = str(node["_id"])
        cluster_id = node.get("clusterId", "")
        node_name = node.get("node", node.get("nodeId", node_id))

        if not cluster_id:
            skipped += 1
            continue

        # Find the cluster
        if cluster_id not in cluster_map:
            # Try as ObjectId
            if ObjectId.is_valid(cluster_id):
                cluster_doc = await clusters_col.find_one({"_id": ObjectId(cluster_id)})
            else:
                cluster_doc = None

            if not cluster_doc:
                warnings.append(f"  WARNING: Node '{node_name}' references cluster '{cluster_id}' which does not exist!")
                skipped += 1
                continue

        # Add node ID to the cluster's nodes array (using $addToSet to avoid duplicates)
        result = await clusters_col.update_one(
            {"_id": ObjectId(cluster_id)},
            {"$addToSet": {"nodes": node_id}}
        )

        if result.modified_count > 0:
            print(f"  Added node '{node_name}' ({node_id}) to cluster '{cluster_map.get(cluster_id, cluster_id)}'")
            updated_clusters += 1
        else:
            print(f"  Node '{node_name}' ({node_id}) already in cluster '{cluster_map.get(cluster_id, cluster_id)}' (no change)")
            skipped += 1

    print("\n" + "=" * 60)
    if warnings:
        for w in warnings:
            print(w)
        print()

    print(f"Migration complete. Added: {updated_clusters}, Skipped/Already present: {skipped}")

    # Step 3: Verify - show final state of each cluster's nodes
    print("\nFinal cluster state:")
    for c in await clusters_col.find({}).to_list(length=None):
        node_ids = c.get("nodes", [])
        node_names = []
        for nid in node_ids:
            if ObjectId.is_valid(nid):
                n = await nodes_col.find_one({"_id": ObjectId(nid)})
                node_names.append(n.get("node", nid) if n else f"(missing: {nid})")
            else:
                node_names.append(nid)
        print(f"  {c.get('clusterName', '?')}: {node_names if node_names else '(no nodes)'}")


if __name__ == "__main__":
    asyncio.run(migrate())
