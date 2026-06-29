import re

def fix(filepath, replacements):
    with open(filepath, 'r') as f:
        c = f.read()
    for old, new in replacements:
        c = c.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(c)

fix('src/pages/AuditLogs/index.tsx', [
    ("slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />,\n            }}", "slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} /> } }}")
])

fix('src/pages/DailyActivities/MorningChecklist/index.tsx', [
    ("slotProps={{ input: { startAdornment: <SearchIcon />,\n            }}", "slotProps={{ input: { startAdornment: <SearchIcon /> } }}")
])

fix('src/pages/OperationLogs/index.tsx', [
    ("slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />\n            }}", "slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} /> } }}")
])

fix('src/pages/Search/index.tsx', [
    ("slotProps={{ input: { startAdornment: (\n                  <InputAdornment position=\"start\">\n                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' }} />\n                  </InputAdornment>\n                ),\n            }}", "slotProps={{ input: { startAdornment: (\n                  <InputAdornment position=\"start\">\n                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' }} />\n                  </InputAdornment>\n                ) } }}")
])

