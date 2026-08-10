import os
import re

def fix_grid(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    # Find all Grid components with sizing props
    # We will just replace xs={X} with size={{xs: X}}
    
    def replacer(match):
        props_str = match.group(1)
        # Find all size props: xs, sm, md, lg, xl
        sizes = {}
        for size in ['xs', 'sm', 'md', 'lg', 'xl']:
            # match size={val} or size="val"
            pattern = rf'\b{size}={{?([^}}\s]+)?[}}]?'
            m = re.search(pattern, props_str)
            if m:
                sizes[size] = m.group(1)
                # Remove it from props_str
                props_str = re.sub(pattern, '', props_str)
        
        if sizes:
            size_prop_val = ", ".join([f"{k}: {v}" for k, v in sizes.items()])
            new_props = f' size={{{{{size_prop_val}}}}} ' + props_str
            return f'<Grid{new_props}>'
        return match.group(0)

    # First regex to match <Grid ...>
    content = re.sub(r'<Grid([^>]+)>', replacer, content)

    if content != original_content:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_grid(os.path.join(root, file))

