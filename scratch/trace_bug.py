"""
Trace the double-skip bug.

Scenario: Stages in routing config:
  1. "Request Submitted" (order 1) - no condition
  2. "IP Assignment" (order 2) - condition: ip is_empty
  3. "VM Creation" (order 3) - no condition  
  4. "Review" (order 4) - no condition

User creates request WITHOUT IP, then on forward_request, 
the IP gets filled in via the payload update (lines 1378-1392).
Then get_applicable_stages is called AFTER the IP has been set.
"""

def is_stage_applicable(stage, request_doc):
    c_field = stage.get("conditionField")
    c_val = stage.get("conditionValue")
    c_operator = stage.get("conditionOperator", "equals")
    if c_operator not in ["is_empty", "is_not_empty"]:
        if not c_field or c_val is None or str(c_val).strip() == "":
            return True
    else:
        if not c_field:
            return True
    details = request_doc.get("details") if isinstance(request_doc.get("details"), dict) else {}
    raw_val = None
    if c_field in details and details[c_field] is not None:
        raw_val = details[c_field]
    elif c_field in request_doc and request_doc[c_field] is not None:
        raw_val = request_doc[c_field]
    if c_operator == "is_empty":
        return raw_val is None or str(raw_val).strip() == ""
    elif c_operator == "is_not_empty":
        return raw_val is not None and str(raw_val).strip() != ""
    if raw_val is None or str(raw_val).strip() == "":
        if c_field == "networkType":
            raw_val = "Internet"
        else:
            raw_val = ""
    actual_val = str(raw_val).strip().lower()
    expected_val = str(c_val).strip().lower()
    if c_operator == "not_equals":
        return actual_val != expected_val
    else:
        return actual_val == expected_val

def get_applicable_stages(stages, request_doc):
    return [s for s in stages if is_stage_applicable(s, request_doc)]

all_stages = [
    {"stageName": "Request Submitted", "order": 1},
    {"stageName": "IP Assignment", "order": 2, "conditionField": "ip", "conditionOperator": "is_empty"},
    {"stageName": "VM Creation", "order": 3},
    {"stageName": "Review", "order": 4},
]

print("=" * 60)
print("STEP 1: CREATE REQUEST (no IP)")
print("=" * 60)
request_doc = {"requestType": "VM Creation", "details": {}, "status": "", "currentStageIndex": 0}

sorted_stages = sorted(all_stages, key=lambda s: s.get("order", 0))
stages_at_create = get_applicable_stages(sorted_stages, request_doc)
print(f"Applicable stages: {[s['stageName'] for s in stages_at_create]}")
# Simulate create: set status to first stage
request_doc["status"] = stages_at_create[0]["stageName"]
request_doc["currentStageIndex"] = 0
print(f"Request status: {request_doc['status']}, index: {request_doc['currentStageIndex']}")

print()
print("=" * 60)
print("STEP 2: FORWARD REQUEST (user provides IP in payload)")
print("=" * 60)
# Simulate forward_request: payload updates details with IP FIRST (lines 1378-1392)
request_doc["details"]["ip"] = "10.0.0.5"
print(f"After payload merge, details = {request_doc['details']}")

# Then get_applicable_stages is called with UPDATED request (line 1417)
stages_at_forward = get_applicable_stages(sorted_stages, request_doc)
print(f"Applicable stages NOW (with IP): {[s['stageName'] for s in stages_at_forward]}")

curr_status = request_doc["status"]
current_index = next((i for i, s in enumerate(stages_at_forward) if s.get("stageName") == curr_status), request_doc.get("currentStageIndex", 0))
next_index = current_index + 1
print(f"curr_status = '{curr_status}'")
print(f"current_index = {current_index} (found '{stages_at_forward[current_index]['stageName']}' in filtered list)")
print(f"next_index = {next_index}")
if next_index < len(stages_at_forward):
    print(f"NEXT STAGE = '{stages_at_forward[next_index]['stageName']}'")
else:
    print("COMPLETED!")
print()
print(">>> Notice: 'IP Assignment' was filtered out because IP is now set,")
print(">>> so the list is [Request Submitted, VM Creation, Review]")
print(">>> current_index=0 (Request Submitted), next_index=1 -> VM Creation")
print(">>> This seems correct... BUT:")

print()
print("=" * 60)
print("ALTERNATE: What if IP is NOT filled during forward? (no IP in payload)")
print("=" * 60)
request_doc2 = {"requestType": "VM Creation", "details": {}, "status": "Request Submitted", "currentStageIndex": 0}

stages_at_forward2 = get_applicable_stages(sorted_stages, request_doc2)
print(f"Applicable stages (no IP): {[s['stageName'] for s in stages_at_forward2]}")
curr_status2 = request_doc2["status"]
current_index2 = next((i for i, s in enumerate(stages_at_forward2) if s.get("stageName") == curr_status2), request_doc2.get("currentStageIndex", 0))
next_index2 = current_index2 + 1
print(f"current_index = {current_index2}, next_index = {next_index2}")
print(f"NEXT STAGE = '{stages_at_forward2[next_index2]['stageName']}'")
print(">>> This goes to IP Assignment correctly")

print()
print("=" * 60)
print("STEP 3: Now at 'IP Assignment', forward again (IP filled now)")
print("=" * 60)
request_doc3 = {"requestType": "VM Creation", "details": {"ip": "10.0.0.5"}, "status": "IP Assignment", "currentStageIndex": 1}
stages_at_forward3 = get_applicable_stages(sorted_stages, request_doc3)
print(f"Applicable stages (IP filled): {[s['stageName'] for s in stages_at_forward3]}")
curr_status3 = request_doc3["status"]
print(f"Looking for status '{curr_status3}' in stages: {[s['stageName'] for s in stages_at_forward3]}")
current_index3 = next((i for i, s in enumerate(stages_at_forward3) if s.get("stageName") == curr_status3), request_doc3.get("currentStageIndex", 0))
next_index3 = current_index3 + 1
print(f"current_index = {current_index3}, next_index = {next_index3}")
if next_index3 < len(stages_at_forward3):
    print(f"NEXT STAGE = '{stages_at_forward3[next_index3]['stageName']}'")
else:
    print("COMPLETED!")

print()
print(">>> BUG! 'IP Assignment' is NOT in the filtered list (because IP is now filled),")
print(">>> so the fallback uses currentStageIndex=1 from the DB.")
print(">>> stages_at_forward3 = ['Request Submitted', 'VM Creation', 'Review']")
print(">>> Index 1 = 'VM Creation', so next_index=2 = 'Review'")
print(">>> VM Creation is SKIPPED!")
