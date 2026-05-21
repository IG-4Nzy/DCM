import glob
import re

for filepath in glob.glob("Backend/*.py"):
    with open(filepath, "r") as f:
        content = f.read()
    
    if "skip: int = Query(0, ge=0)" in content:
        # Add pagination parameter
        content = content.replace("limit: int = Query(", "pagination: bool = Query(True),\n    limit: int = Query(")
        
        # Modify the query execution
        # Find lines like: cursor = ...find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
        # Or: cursor = ...find(query).sort(sort_by, sort_order)
        # We can just replace skip(skip).limit(limit) with conditional
        # Wait, regex is better:
        
        # Replace the logic:
        # total = await ...count_documents(query)
        # cursor = ...find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
        # items = await cursor.to_list(length=limit)
        
        pattern = re.compile(r"(total = await [a-zA-Z0-9_]+\.count_documents\(query\)\s*cursor = [a-zA-Z0-9_]+\.find\(query\)\.sort\(sort_by, sort_order\))\.skip\(skip\)\.limit\(limit\)\s*([a-zA-Z0-9_]+) = await cursor\.to_list\(length=limit\)")
        
        def replacer(match):
            base_query = match.group(1)
            var_name = match.group(2)
            return f"""{base_query}
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        {var_name} = await cursor.to_list(length=limit)
    else:
        {var_name} = await cursor.to_list(length=None)"""

        new_content = pattern.sub(replacer, content)
        
        if new_content != content:
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Updated {filepath}")
