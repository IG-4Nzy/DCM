import os

filepath = "frontend/src/pages/Users/index.tsx"
with open(filepath, "r") as f:
    content = f.read()

# For roles
content = content.replace('value={role.name}', 'value={role.id || role._id}')
content = content.replace('key={role.id}', 'key={role.id || role._id}')
# For departments
content = content.replace('value={dept.name}', 'value={dept.id || dept._id}')
content = content.replace('key={dept.id}', 'key={dept.id || dept._id}')

with open(filepath, "w") as f:
    f.write(content)

print("Patched users index.tsx")
