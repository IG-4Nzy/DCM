import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    
    # WarningIcon sx -> style
    content = content.replace("<WarningIcon sx={{", "<WarningIcon style={{")
    
    # getClusterName(row.clusterId) -> getClusterName(row.clusterId || '')
    content = content.replace("getClusterName(row.clusterId)", "getClusterName(row.clusterId || '')")
    
    # handleDelete(row.id, row.ipAddress) -> handleDelete(row.id || '', row.ipAddress || '')
    content = content.replace("handleDelete(row.id, row.ipAddress)", "handleDelete(row.id || '', row.ipAddress || '')")

    # Grid props to sx
    # This is tricky because we might already have sx={}
    # Let's find <Grid ... > tags and replace alignItems="..." with sx={{ alignItems: "..." }}
    
    def replacer(match):
        tag = match.group(0)
        
        # Check if alignItems, justifyContent, direction exist
        props_to_move = {}
        for prop in ['alignItems', 'justifyContent', 'direction']:
            m = re.search(rf'{prop}="([^"]+)"', tag)
            if m:
                props_to_move[prop] = f"'{m.group(1)}'"
                tag = re.sub(rf'{prop}="([^"]+)"', '', tag)
                
            m_brace = re.search(rf'{prop}={{([^}}]+)}}', tag)
            if m_brace:
                props_to_move[prop] = m_brace.group(1)
                tag = re.sub(rf'{prop}={{([^}}]+)}}', '', tag)
                
        if not props_to_move:
            return tag
            
        sx_str = ", ".join([f"{k}: {v}" for k, v in props_to_move.items()])
        
        # Merge into existing sx or add new
        if 'sx={{' in tag:
            tag = tag.replace('sx={{', f'sx={{{{ {sx_str}, ')
        else:
            # insert before the closing >
            tag = tag[:-1] + f' sx={{{{ {sx_str} }}}} >'
            
        return tag

    content = re.sub(r'<Grid[^>]+>', replacer, content)
    
    if content != original:
        print(f"Fixed {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))

