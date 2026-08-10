import re

with open("Backend/services/vcenter/inventory_service.py", "r") as f:
    content = f.read()

new_logic = """
        async def fetch():
            found_ips = []
            def extract_ips(obj):
                if isinstance(obj, dict):
                    if "ip_address" in obj and isinstance(obj["ip_address"], str):
                        found_ips.append(obj["ip_address"])
                    if "ipAddress" in obj and isinstance(obj["ipAddress"], str):
                        found_ips.append(obj["ipAddress"])
                    for v in obj.values():
                        extract_ips(v)
                elif isinstance(obj, list):
                    for item in obj:
                        extract_ips(item)

            endpoints_to_try = [
                f"/api/vcenter/vm/{vm_id}/guest/identity",
                f"/api/vcenter/vm/{vm_id}/guest/networking",
                f"/api/vcenter/vm/{vm_id}/guest/networking/interfaces",
                f"/rest/vcenter/vm/{vm_id}/guest/identity",
                f"/rest/vcenter/vm/{vm_id}/guest/networking",
                f"/rest/vcenter/vm/{vm_id}/guest/networking/interfaces"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    res = await client.get(f"https://{ip_address}{endpoint}", headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        extract_ips(data)
                        for ip in found_ips:
                            if ip and not ip.startswith("fe80") and not ip.startswith("::") and ":" not in ip and ip != "127.0.0.1":
                                return ip
                except Exception as e:
                    logger.debug(f"Failed guest IP lookup on {endpoint} for {vm_id}: {e}")
                    
            return None
"""

pattern = r"async def fetch\(\):.*?return None"
content = re.sub(pattern, new_logic.strip(), content, flags=re.DOTALL)

with open("Backend/services/vcenter/inventory_service.py", "w") as f:
    f.write(content)
