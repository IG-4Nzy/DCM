import os
import re

def fix_grid_item(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Match `<Grid ... item ...>`
    new_content = re.sub(r'<Grid([^>]*?)\s+item(?:\s*=\s*(?:{[^}]+}|"[^"]*"|\'[^\']*\'))?([^>]*)>', r'<Grid\1\2>', content)
    
    if new_content != content:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(new_content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_grid_item(os.path.join(root, file))
