import os
import re

def fix_props(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # Replace InputLabelProps={{ shrink: true }} with slotProps={{ inputLabel: { shrink: true } }}
    content = re.sub(r'InputLabelProps=\{\{\s*shrink:\s*true\s*\}\}', r'slotProps={{ inputLabel: { shrink: true } }}', content)
    
    # Replace passNumber: formPassNumber || null with formPassNumber || undefined in Users/index.tsx
    if 'Users/index.tsx' in filepath:
        content = content.replace('passNumber: formPassNumber || null,', 'passNumber: formPassNumber || undefined,')

    # Fix InputProps={{ startAdornment: ... }}
    # This is a bit complex as it can be multiline, but we can do a naive replace for simple cases if needed.
    # Actually, the user did this manually in some files. Let's do a simple regex for InputProps.
    # Wait, doing complex regex for nested braces is hard in Python without a proper parser. 
    # I'll just rely on `tsc` output if we need to fix specific ones.

    if content != original:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_props(os.path.join(root, file))

