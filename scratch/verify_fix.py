"""Verify the fix for the double-skip bug."""

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

# --- NEW FIXED LOGIC ---
def find_next_index_fixed(sorted_stages, stages, curr_status, existing):
    found_index = next((i for i, s in enumerate(stages) if s.get("stageName") == curr_status), None)
    if found_index is not None:
        return found_index + 1
    else:
        curr_order = next((s.get("order", 0) for s in sorted_stages if s.get("stageName") == curr_status), 0)
        return next((i for i, s in enumerate(stages) if s.get("order", 0) > curr_order), len(stages))

# --- OLD BUGGY LOGIC ---
def find_next_index_old(stages, curr_status, existing):
    current_index = next((i for i, s in enumerate(stages) if s.get("stageName") == curr_status), existing.get("currentStageIndex", 0))
    return current_index + 1

all_stages = [
    {"stageName": "Request Submitted", "order": 1},
    {"stageName": "IP Assignment", "order": 2, "conditionField": "ip", "conditionOperator": "is_empty"},
    {"stageName": "VM Creation", "order": 3},
    {"stageName": "Review", "order": 4},
]
sorted_stages = sorted(all_stages, key=lambda s: s.get("order", 0))

print("=" * 60)
print("BUG SCENARIO: At 'IP Assignment', IP now filled")
print("=" * 60)
existing = {"details": {"ip": "10.0.0.5"}, "status": "IP Assignment", "currentStageIndex": 1}
stages = get_applicable_stages(sorted_stages, existing)
print(f"Filtered stages: {[s['stageName'] for s in stages]}")

old_next = find_next_index_old(stages, "IP Assignment", existing)
new_next = find_next_index_fixed(sorted_stages, stages, "IP Assignment", existing)

print(f"OLD next_index={old_next} -> '{stages[old_next]['stageName'] if old_next < len(stages) else 'COMPLETED'}'")
print(f"NEW next_index={new_next} -> '{stages[new_next]['stageName'] if new_next < len(stages) else 'COMPLETED'}'")

print()
print("=" * 60)
print("NORMAL: At 'Request Submitted', no IP")
print("=" * 60)
existing2 = {"details": {}, "status": "Request Submitted", "currentStageIndex": 0}
stages2 = get_applicable_stages(sorted_stages, existing2)
print(f"Filtered stages: {[s['stageName'] for s in stages2]}")

old_next2 = find_next_index_old(stages2, "Request Submitted", existing2)
new_next2 = find_next_index_fixed(sorted_stages, stages2, "Request Submitted", existing2)
print(f"OLD next_index={old_next2} -> '{stages2[old_next2]['stageName']}'")
print(f"NEW next_index={new_next2} -> '{stages2[new_next2]['stageName']}'")

print()
print("=" * 60)
print("NORMAL: At 'VM Creation', IP filled")
print("=" * 60)
existing3 = {"details": {"ip": "10.0.0.5"}, "status": "VM Creation", "currentStageIndex": 2}
stages3 = get_applicable_stages(sorted_stages, existing3)
print(f"Filtered stages: {[s['stageName'] for s in stages3]}")

old_next3 = find_next_index_old(stages3, "VM Creation", existing3)
new_next3 = find_next_index_fixed(sorted_stages, stages3, "VM Creation", existing3)
print(f"OLD next_index={old_next3} -> '{stages3[old_next3]['stageName'] if old_next3 < len(stages3) else 'COMPLETED'}'")
print(f"NEW next_index={new_next3} -> '{stages3[new_next3]['stageName'] if new_next3 < len(stages3) else 'COMPLETED'}'")
