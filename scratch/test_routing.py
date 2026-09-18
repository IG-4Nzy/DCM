def is_stage_applicable(stage: dict, request_doc: dict) -> bool:
    c_field = stage.get("conditionField")
    c_val = stage.get("conditionValue")
    c_operator = stage.get("conditionOperator", "equals")

    if not c_field:
        return True

    if c_operator not in ["is_empty", "is_not_empty"] and (c_val is None or str(c_val).strip() == ""):
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

stage1 = {"conditionField": "requestType", "conditionValue": "VM Creation", "conditionOperator": "equals"}
req1 = {"requestType": "VM Creation"}
print("Test 1:", is_stage_applicable(stage1, req1))

stage2 = {"conditionField": "ip", "conditionValue": "", "conditionOperator": "is_empty"}
req2 = {"details": {"ip": ""}}
print("Test 2:", is_stage_applicable(stage2, req2))

stage3 = {"conditionField": "requestType", "conditionValue": "VM Creation"}
req3 = {"requestType": "VM Creation"}
print("Test 3:", is_stage_applicable(stage3, req3))
