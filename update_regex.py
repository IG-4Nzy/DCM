import os
import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    def replacer(match):
        chars = match.group(1)
        to_add = ""
        # Check if literal hyphen is present: either escaped \- or at the start/end of chars
        has_hyphen = (r'\-' in chars) or chars.startswith('-') or chars.endswith('-')
        if not has_hyphen:
            to_add += r'\-'
            
        # For comma
        if ',' not in chars:
            to_add += ','
            
        # For dot
        if '.' not in chars and r'\.' not in chars:
            to_add += '.'
            
        # For slash
        if '/' not in chars and r'\/' not in chars:
            to_add += r'\/'
            
        # For pipe
        if '|' not in chars and r'\|' not in chars:
            to_add += '|'
            
        return f"/^[{chars}{to_add}]+$/"
        
    new_content = re.sub(r'/\^\[([^\]]+)\]\+\$/', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            update_file(os.path.join(root, file))

