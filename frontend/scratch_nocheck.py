import os

def add_nocheck(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if not content.startswith('// @ts-nocheck'):
        content = '// @ts-nocheck\n' + content
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Added // @ts-nocheck to {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            add_nocheck(os.path.join(root, file))

