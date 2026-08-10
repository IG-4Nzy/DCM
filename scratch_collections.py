from pymongo import MongoClient

client = MongoClient("mongodb://admin:password@localhost:27017/")
db = client["dcm_database"]
nodes_col = db["nodes"]

print("All documents in nodes collection:")
for doc in nodes_col.find():
    print(doc)
