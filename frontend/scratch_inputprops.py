import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # Replace inputProps={{ ... }} with slotProps={{ htmlInput: { ... } }}
    # Only if it's not already inside a slotProps or something
    content = re.sub(r'inputProps=\{\{(.*?)\}\}', r'slotProps={{ htmlInput: {\1} }}', content, flags=re.DOTALL)
    
    if content != original:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))

