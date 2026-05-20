import sys

filename = "Backend/models.py"
with open(filename, "r") as f:
    content = f.read()

content = content.replace("updatedAt: Optional[str] = None", "updatedAt: Optional[str] = None\n    updatedByFullName: Optional[str] = None")

with open(filename, "w") as f:
    f.write(content)

print("Updated Backend/models.py")
