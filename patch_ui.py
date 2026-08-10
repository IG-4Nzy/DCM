import re

with open("frontend/src/pages/ServerMonitoring/index.tsx", "r") as f:
    content = f.read()

# Update interfaces
interface_patch = """
interface Alarm {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  timestamp: string;
}

interface Notification {
  id: string;
  timestamp: string;
  message: string;
}

interface Action {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

interface EventLog {
"""

content = content.replace("interface Alarm {\n  id: string;\n  severity: 'Critical' | 'Warning' | 'Info';\n  message: string;\n  timestamp: string;\n}\n\ninterface EventLog {", interface_patch)

monitor_data_patch = """  alarms: Alarm[];
  events: EventLog[];
  notifications: Notification[];
  actions: Action[];
"""
content = content.replace("  alarms: Alarm[];\n  events: EventLog[];\n", monitor_data_patch)

# Add imports for UI icons
icon_imports = """  MdSearch as SearchIcon,
  MdDelete as DeleteIcon,
  MdArrowBack as BackIcon,
  MdCheckCircle as HealthyIcon,
  MdWarning as WarningIcon,
  MdKeyboardArrowDown as KeyboardArrowDownIcon,
  MdKeyboardArrowUp as KeyboardArrowUpIcon,
  MdLayers as ClusterIcon,
  MdInfo as InfoIcon,
  MdPerson as PersonIcon"""
content = content.replace("  MdSearch as SearchIcon,\n  MdDelete as DeleteIcon,\n  MdArrowBack as BackIcon,\n  MdCheckCircle as HealthyIcon,\n  MdWarning as WarningIcon,\n  MdKeyboardArrowDown as KeyboardArrowDownIcon,\n  MdKeyboardArrowUp as KeyboardArrowUpIcon,\n  MdLayers as ClusterIcon", icon_imports)

# Add UI sections in the right column
ui_patch = """
                {/* 3. System Notifications */}
                <Box className={styles.container__sectionCard}>
                  <h3 className={styles.container__sectionCard__title}>
                    <InfoIcon style={{ color: '#3b82f6' }} /> System Notifications ({monitorData.notifications?.length || 0})
                  </h3>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(!monitorData.notifications || monitorData.notifications.length === 0) ? (
                      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                        No new notifications.
                      </Typography>
                    ) : (
                      monitorData.notifications.map((notif, idx) => (
                        <div key={idx} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a8a' }}>{notif.message}</Typography>
                          <Typography variant="caption" sx={{ color: '#3b82f6' }}>{new Date(notif.timestamp).toLocaleString()}</Typography>
                        </div>
                      ))
                    )}
                  </Box>
                </Box>

                {/* 4. Admin Actions */}
                <Box className={styles.container__sectionCard}>
                  <h3 className={styles.container__sectionCard__title}>
                    <PersonIcon style={{ color: '#8b5cf6' }} /> Audit & Actions ({monitorData.actions?.length || 0})
                  </h3>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(!monitorData.actions || monitorData.actions.length === 0) ? (
                      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                        No recent admin actions.
                      </Typography>
                    ) : (
                      monitorData.actions.map((act, idx) => (
                        <div key={idx} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#4c1d95' }}>{act.user} - {act.action}</Typography>
                          <Typography variant="caption" sx={{ color: '#8b5cf6' }}>{new Date(act.timestamp).toLocaleString()}</Typography>
                        </div>
                      ))
                    )}
                  </Box>
                </Box>
"""

content = content.replace("              </Box>\n\n            </Box>", ui_patch + "\n              </Box>\n\n            </Box>")

with open("frontend/src/pages/ServerMonitoring/index.tsx", "w") as f:
    f.write(content)
