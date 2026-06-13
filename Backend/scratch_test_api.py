import urllib.request
import urllib.parse
import json

# 1. Login
login_url = "http://127.0.0.1:8000/api/auth/login"
payload = json.dumps({"username": "admin", "password": "admin"}).encode('utf-8')
req = urllib.request.Request(
    login_url,
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as res:
        login_res = json.loads(res.read().decode('utf-8'))
        token = login_res.get("token")
        print("Logged in. Token length:", len(token) if token else 0)

    # 2. Fetch rosters
    rosters_url = "http://127.0.0.1:8000/api/roasters/?startDate=2026-06-07&endDate=2026-06-14&department=CITG"
    req_rosters = urllib.request.Request(
        rosters_url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET"
    )
    with urllib.request.urlopen(req_rosters) as res_rosters:
        rosters_res = json.loads(res_rosters.read().decode('utf-8'))
        print("Roster data:", json.dumps(rosters_res, indent=2))

except Exception as e:
    print("Error:", e)
