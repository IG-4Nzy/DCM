import os

filepath = "Backend/auth.py"
with open(filepath, "r") as f:
    content = f.read()

# We need to resolve the department and roles in the login response
print("Patching auth...")
