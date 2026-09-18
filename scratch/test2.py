def is_stage_applicable(stage: dict, request_doc: dict) -> bool:
    c_field = stage.get("conditionField")
    c_val = stage.get("conditionValue")
    c_operator = stage.get("conditionOperator", "equals")

    # For standard operators, if condition is incomplete, assume it's always applicable
    if c_operator not in ["is_empty", "is_not_empty"]:
        if not c_field or c_val is None or str(c_val).strip() == "":
            return True
    else:
        # For is_empty/is_not_empty, we only need the field
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

# Test 1: User set "ip" but NO operator and NO value (empty value).
print("Empty conditionValue, equals:", is_stage_applicable({"conditionField": "ip"}, {"details": {}}))
# Test 2: User set "ip is_empty"
print("is_empty:", is_stage_applicable({"conditionField": "ip", "conditionOperator": "is_empty"}, {"details": {}}))
