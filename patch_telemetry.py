import re

with open("Backend/tasks/telemetry_scheduler.py", "r") as f:
    content = f.read()

# Add notifications and actions
new_lists = """
            notifications = [
                {
                    "id": "notif-1",
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "message": "Update available for vCenter Server Appliance."
                }
            ]
            actions = [
                {
                    "id": "action-1",
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "user": "system",
                    "action": "Triggered scheduled telemetry sync"
                }
            ]
            
            # Store them in vcenter_logs collection
            logs_col = db.get_collection("vcenter_logs")
            log_entries = []
            for a in alarms:
                log_entries.append({"vcenterId": vc_id, "type": "Alarm", "severity": a.get("severity"), "message": a.get("message"), "timestamp": a.get("timestamp")})
            for e in events:
                log_entries.append({"vcenterId": vc_id, "type": "Event", "severity": "Info", "message": e.get("message"), "timestamp": e.get("timestamp")})
            for n in notifications:
                log_entries.append({"vcenterId": vc_id, "type": "Notification", "severity": "Info", "message": n.get("message"), "timestamp": n.get("timestamp")})
            for a in actions:
                log_entries.append({"vcenterId": vc_id, "type": "Action", "severity": "Info", "message": f"{a.get('user')} - {a.get('action')}", "timestamp": a.get("timestamp")})
            
            if log_entries:
                for entry in log_entries:
                    # Upsert to avoid duplicates
                    logs_col.update_one(
                        {"vcenterId": vc_id, "type": entry["type"], "message": entry["message"], "timestamp": entry["timestamp"]},
                        {"$set": entry},
                        upsert=True
                    )
"""

content = content.replace('events = [', new_lists + '\n            events = [')

snapshot_update = """
                "alarms": alarms,
                "events": events,
                "notifications": notifications,
                "actions": actions,
"""
content = re.sub(r'"alarms": alarms,\s*"events": events,', snapshot_update, content)

with open("Backend/tasks/telemetry_scheduler.py", "w") as f:
    f.write(content)
