from bson import ObjectId

w = {"assignees": [ObjectId()]}
assignees = w.get("assignees") or ([w["assignee"]] if w.get("assignee") else [])
names = []
user_map = {}
for a in assignees:
    names.append(user_map.get(a, "User Removed"))
assigneesFullName = ", ".join(names) if names else "Unassigned"
print("assigneesFullName:", assigneesFullName)
