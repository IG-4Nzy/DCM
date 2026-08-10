import os
import re

files_to_fix = [
    'src/pages/Dashboard/components/KpiCard.tsx',
    'src/pages/Dashboard/components/SectionHeader.tsx',
    'src/pages/Dashboard/components/RosterCard.tsx',
    'src/pages/Dashboard/components/RecentObservationsCard.tsx',
    'src/pages/Dashboard/components/ChecklistStatusCard.tsx',
    'src/pages/Dashboard/components/OpenRequestsCard.tsx',
    'src/pages/Dashboard/components/PendingWorksCard.tsx',
    'src/pages/Dashboard/components/ChecklistCard.tsx',
    'src/pages/Dashboard/components/RecentOperationLogsCard.tsx'
]

# A more robust regex replacement might be needed, but since we are modifying specific files,
# we can just use simple string replacements or regex.
def process_file(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # We want to remove display="flex", alignItems="...", justifyContent="...", flexDirection="...", textAlign="..." 
    # from Box and Typography components that are NOT within sx={{...}}
    
    # Match <Box ...> or <Typography ...> and move the properties to sx
    def replacer(match):
        tag = match.group(0)
        
        # Check if alignItems, justifyContent, direction exist
        props_to_move = {}
        for prop in ['alignItems', 'justifyContent', 'flexDirection', 'textAlign', 'display']:
            m = re.search(rf'\b{prop}="([^"]+)"', tag)
            if m:
                props_to_move[prop] = f"'{m.group(1)}'"
                tag = re.sub(rf'\b{prop}="([^"]+)"', '', tag)
                
            m_brace = re.search(rf'\b{prop}={{([^}}]+)}}', tag)
            if m_brace:
                props_to_move[prop] = m_brace.group(1)
                tag = re.sub(rf'\b{prop}={{([^}}]+)}}', '', tag)
                
        if not props_to_move:
            return tag
            
        sx_str = ", ".join([f"{k}: {v}" for k, v in props_to_move.items()])
        
        # Merge into existing sx or add new
        if 'sx={{' in tag:
            tag = tag.replace('sx={{', f'sx={{{{ {sx_str}, ')
        else:
            # insert before the closing >
            # Careful with self-closing tags '/>'
            if tag.endswith('/>'):
                tag = tag[:-2] + f' sx={{{{ {sx_str} }}}} />'
            else:
                tag = tag[:-1] + f' sx={{{{ {sx_str} }}}} >'
            
        return tag

    content = re.sub(r'<(Box|Typography|CardContent)\b[^>]*>', replacer, content)
    
    if content != original:
        print(f"Fixed props in {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for f in files_to_fix:
    process_file(f)
    
# Process ALL files in the project just to be safe
for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

