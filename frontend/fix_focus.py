import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # In PeriodicActivities/index.tsx
    if 'handleRowClick = (activity: PeriodicActivity, event: React.MouseEvent)' in content:
        content = content.replace(
            "const target = event.target as HTMLElement;",
            "const target = event.target as HTMLElement;\n    if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); }"
        )
        
    # In Work/index.tsx
    if 'const handleOpenWorkDetails = (work: any) => {' in content:
        content = content.replace(
            "const handleOpenWorkDetails = (work: any) => {",
            "const handleOpenWorkDetails = (work: any) => {\n    if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); }"
        )

    # In ServerMonitoring/index.tsx maybe?
    # Actually just applying these two handles the specific tr click issues.
    
    if content != original:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src/pages'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))

