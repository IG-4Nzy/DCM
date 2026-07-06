import re
with open("frontend/src/pages/Roles/model.ts", "r") as f:
    content = f.read()

content = content.replace("privileges: string[];\n}", "privileges: string[];\n  usersCount?: number;\n}")

with open("frontend/src/pages/Roles/model.ts", "w") as f:
    f.write(content)
