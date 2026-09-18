import asyncio
from Backend.requests_router import is_stage_applicable

request_doc = {
    "requestType": "VM Creation",
    "details": {
        "ip": None
    }
}
stage = {"conditionField": "ip", "conditionOperator": "is_empty"}
print("With None:", is_stage_applicable(stage, request_doc))

request_doc2 = {
    "requestType": "VM Creation",
    "details": {}
}
print("With missing:", is_stage_applicable(stage, request_doc2))

request_doc3 = {
    "requestType": "VM Creation",
    "details": {
        "ip": "null"
    }
}
print("With string null:", is_stage_applicable(stage, request_doc3))

