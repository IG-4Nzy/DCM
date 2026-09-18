# Fix Condition Evaluation for Empty Values

The user reported that the VM creation stage is skipped when the IP is not provided, even if they configured the stage condition with `ip is_empty`. The stage correctly evaluates to skip when the IP is provided (which they consider "working correctly"), but it incorrectly skips when the IP is empty.

This happens because the `is_empty` evaluation in the backend `is_stage_applicable` function is not fully handling all "empty" string variations that the frontend might send (e.g. `"null"`, `"undefined"`, `"none"`, or `"-"`), causing it to evaluate to `False` (which skips the stage) instead of `True`. 

We will update the `is_stage_applicable` logic in `Backend/requests_router.py` to correctly evaluate string variants of empty values.

## Proposed Changes

### [MODIFY] Backend/requests_router.py
Update the `is_stage_applicable` function to robustly check for empty values:

```python
    def _is_empty_val(v):
        if v is None:
            return True
        s = str(v).strip().lower()
        return s in ["", "null", "undefined", "none", "-"]

    if c_operator == "is_empty":
        return _is_empty_val(raw_val)
    elif c_operator == "is_not_empty":
        return not _is_empty_val(raw_val)
```
Update the fallback logic as well:
```python
    if _is_empty_val(raw_val):
        if c_field == "networkType":
            raw_val = "Internet"
        else:
            raw_val = ""
```

