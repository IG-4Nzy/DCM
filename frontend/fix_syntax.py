import os

files_to_fix = [
    'src/pages/Attendance/index.tsx',
    'src/pages/Documentations/index.tsx',
    'src/pages/Search/index.tsx',
    'src/pages/AuditLogs/index.tsx',
    'src/pages/OperationLogs/index.tsx',
    'src/pages/ServerPingMonitoring/index.tsx',
    'src/pages/DailyActivities/MorningChecklist/index.tsx',
    'src/pages/ServerMonitoring/index.tsx'
]

for file in files_to_fix:
    try:
        with open(file, 'r') as f:
            content = f.read()

        # Fix the broken replacement
        content = content.replace("} }} />", "}} />")
        content = content.replace("} }} />,", "}} />,")
        content = content.replace("} }} />\n", "}} />\n")
        content = content.replace("} }} />\n", "}} />\n")

        # In Documentations
        content = content.replace(
            "slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' } }} />,\n            }}",
            "slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} /> } }}"
        )
        # Search
        content = content.replace(
            "slotProps={{ input: { startAdornment: (\n                  <InputAdornment position=\"start\">\n                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' } }} />\n                  </InputAdornment>\n                ),\n            }}",
            "slotProps={{ input: { startAdornment: (\n                  <InputAdornment position=\"start\">\n                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' }} />\n                  </InputAdornment>\n                ) } }}"
        )
        
        # Another pattern
        content = content.replace("} }} />", "}} />")

        with open(file, 'w') as f:
            f.write(content)
            
    except Exception as e:
        print("Error in ", file, e)

