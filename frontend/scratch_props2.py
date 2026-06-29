import os
import re

def fix_props(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # 1. Replace PaperProps={{ ... }} with slotProps={{ paper: { ... } }}
    # We will use regex to find PaperProps={{ and matching brace. 
    # Since regex can't easily balance braces, we can just do a greedy replacement if it's single line, or semi-greedy.
    # Actually, often it's: PaperProps={{ sx: ... }}
    content = re.sub(r'PaperProps=\{\{\s*(style|sx):\s*\{([^}]*)\}\s*\}\}', r'slotProps={{ paper: { \1: {\2} } }}', content)
    content = re.sub(r'PaperProps=\{\{(.*?)\}\}', r'slotProps={{ paper: {\1} }}', content, flags=re.DOTALL)
    
    # 2. Replace InputProps={{ ... }} with slotProps={{ input: { ... } }}
    # This is tricky because it might have multiple braces.
    # We'll just fix the common ones: InputProps={{ startAdornment: ... }}
    content = re.sub(r'InputProps=\{\{\s*startAdornment:(.*?)\}\}', r'slotProps={{ input: { startAdornment:\1} }}', content, flags=re.DOTALL)
    content = re.sub(r'InputProps=\{\{\s*endAdornment:(.*?)\}\}', r'slotProps={{ input: { endAdornment:\1} }}', content, flags=re.DOTALL)
    
    # Also if there's an id => we just make it (id: any) =>
    if 'ServerPingMonitoring/index.tsx' in filepath:
        content = content.replace('currentOfflineIds.some(id =>', 'currentOfflineIds.some((id: any) =>')
        content = content.replace('<WarningIcon sx={{ color: \'#ef4444\' }} />', '<WarningIcon style={{ color: \'#ef4444\' }} />')

    if content != original:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_props(os.path.join(root, file))

