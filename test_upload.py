import requests

url = "http://127.0.0.1:8000/api/works/upload"
with open("test.txt", "w") as f:
    f.write("test content")

files = {'files': open('test.txt', 'rb')}
# Let's bypass auth if possible, wait, it requires auth! dependencies=[Depends(get_current_user)]
print("Requires Auth, so we can't easily test without a token.")
