import asyncio
import os
import sys
from bson import ObjectId

# Ensure Backend directory is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db

async def update_cluster_network_types():
    clusters_coll = db.get_collection("clusters")
    vm_coll = db.get_collection("vm_details")
    nodes_coll = db.get_collection("nodes")

    clusters = await clusters_coll.find({}).to_list(length=None)
    print(f"Found {len(clusters)} cluster(s) to process.\n")

    updated_count = 0

    for cluster in clusters:
        cluster_id = str(cluster["_id"])
        cluster_name = cluster.get("clusterName", "")
        current_network = cluster.get("networkType", "")

        # Find VMs associated with this cluster (by clusterId or clusterName)
        vms = await vm_coll.find({
            "$or": [
                {"clusterId": cluster_id},
                {"clusterName": cluster_name},
                {"cluster": cluster_name}
            ]
        }).to_list(length=None)

        # Collect all IP addresses from VMs
        ips = []
        for vm in vms:
            ip = vm.get("ipAddress") or vm.get("ip")
            if ip:
                ips.append(str(ip).strip())

        # Fallback: check nodes attached to the cluster if no VM IPs found
        if not ips:
            nodes = await nodes_coll.find({
                "$or": [
                    {"clusterId": cluster_id},
                    {"clusterName": cluster_name}
                ]
            }).to_list(length=None)
            for node in nodes:
                ip = node.get("ipAddress") or node.get("ip")
                if ip:
                    ips.append(str(ip).strip())

        # Determine network type based on IPs
        detected_network = None
        for ip in ips:
            if ip.startswith("192.") or "192.168." in ip:
                detected_network = "internet"
                break
            elif ip.startswith("10."):
                detected_network = "intranet"

        if not detected_network:
            detected_network = "intranet"

        print(f"Cluster: '{cluster_name}' (ID: {cluster_id}) | Found IPs: {ips} | Determined: '{detected_network}'")

        if current_network != detected_network:
            await clusters_coll.update_one(
                {"_id": cluster["_id"]},
                {"$set": {"networkType": detected_network}}
            )
            print(f"  [+] Updated networkType from '{current_network}' to '{detected_network}'")
            updated_count += 1
        else:
            print(f"  [=] Already set to '{current_network}'")

    print(f"\nCompleted processing. Updated {updated_count} cluster(s).")

if __name__ == "__main__":
    asyncio.run(update_cluster_network_types())
