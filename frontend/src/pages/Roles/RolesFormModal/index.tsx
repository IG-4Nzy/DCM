import Modal from '../../../components/Modal'
import TextField from '../../../components/TextField'
import { Button, FormControl, InputLabel, MenuItem, Select, Box, Checkbox, FormControlLabel, Grid, Typography, Paper, Divider } from '@mui/material'
import type { UpdateRolePayload } from '../model';
import styles from './index.module.scss';
import React from 'react';

interface PropType {
    isModalOpen: boolean;
    handleCloseModal: () => void;
    editingRole: UpdateRolePayload | null;
    formName: string;
    setFormName: (value: string) => void;
    formStatus: boolean;
    setFormStatus: (value: boolean) => void;
    formPrivileges: string[];
    setFormPrivileges: (value: string[]) => void;
    availablePrivileges: string[];
    handleSubmit: (e: React.FormEvent) => void;
}

const PRIVILEGE_GROUPS: { [category: string]: string[] } = {
  "Dashboard & Server Monitoring": [
    "View Dashboard",
    "View Server Monitoring",
    "Create Server Monitoring",
    "Update Server Monitoring",
    "Delete Server Monitoring",
    "View Server Ping Monitoring",
    "Create Server Ping Monitoring",
    "Update Server Ping Monitoring",
    "Delete Server Ping Monitoring"
  ],
  "Users & Roles": [
    "View All Users",
    "View Department Users",
    "Create User",
    "Update User",
    "Delete User",
    "View Role",
    "Create Role",
    "Update Role",
    "Delete Role"
  ],
  "BMS Checklist": [
    "View BMS Checklist",
    "View All Department BMS Checklist",
    "Create BMS Checklist",
    "Update BMS Checklist",
    "Delete BMS Checklist",
    "Edit BMS Checklist Field"
  ],
  "Morning Checklist": [
    "View Morning Checklist",
    "Create Morning Checklist",
    "Update Morning Checklist",
    "Delete Morning Checklist",
    "Edit Morning Checklist Field"
  ],
  "Cluster Checklist": [
    "View Cluster Checklist",
    "View All Department Cluster Checklist",
    "Create Cluster Checklist",
    "Update Cluster Checklist",
    "Delete Cluster Checklist",
    "Edit Cluster Checklist Field"
  ],
  "Roaster & Attendance": [
    "View Roaster",
    "Create Roaster",
    "Update Roaster",
    "Delete Roaster",
    "Approve Roaster",
    "View Self Attendance",
    "View Departmental Attendance",
    "View All Attendance",
    "Create Attendance",
    "Update Attendance",
    "Delete Attendance",
    "Attendance Verify",
    "View Attendance Verification"
  ],
  "Work & Departments": [
    "View All Work",
    "View Assigned Work",
    "Create Work",
    "Update Work",
    "Delete Work",
    "View Department",
    "Create Department",
    "Update Department",
    "Delete Department"
  ],
  "Observations": [
    "View Observations",
    "View All Department Observations",
    "Create Observation",
    "Update Observation",
    "Delete Observation",
    "View Observation Category",
    "Create Observation Category",
    "Update Observation Category",
    "Delete Observation Category"
  ],
  "Inventory": [
    "View All Inventory",
    "View Department Inventory",
    "Create Inventory",
    "Update Inventory",
    "Delete Inventory"
  ],
  "Configurations & Virtualization": [
    "View Configurations",
    "Create Configuration",
    "Update Configurations",
    "Delete Configurations",
    "View Server Details",
    "Create Server Details",
    "Update Server Details",
    "Delete Server Details",
    "View Cluster",
    "Create Cluster",
    "Update Cluster",
    "Delete Cluster"
  ],
  "Requests & Search": [
    "View Request",
    "Create Request",
    "Update Request",
    "Delete Request",
    "View Search"
  ],
  "Documentations": [
    "View Documentation",
    "Create Documentation",
    "Update Documentation",
    "Delete Documentation"
  ],
  "Periodic Activities": [
    "View Periodic Activity",
    "Create Periodic Activity",
    "Update Periodic Activity",
    "Delete Periodic Activity"
  ],
  "Announcements": [
    "View Announcements",
    "Create Announcement",
    "Update Announcement",
    "Delete Announcement"
  ],
  "Notification Triggering": [
    "View Notification Triggering"
  ],
  "Operation & Audit Logs": [
    "View Logs",
    "Create Log",
    "Update Log",
    "Delete Log",
    "View Audit Logs"
  ]
};

const RoleFormModal = ({ 
    isModalOpen, 
    handleCloseModal, 
    editingRole, 
    formName, 
    setFormName, 
    formStatus, 
    setFormStatus, 
    formPrivileges = [], 
    setFormPrivileges, 
    availablePrivileges = [],
    handleSubmit 
}:PropType) => {

    const safeFormPrivileges = formPrivileges || [];
    const safeAvailablePrivileges = availablePrivileges || [];

    const handleTogglePrivilege = (privilege: string) => {
        if (safeFormPrivileges.includes(privilege)) {
            setFormPrivileges(safeFormPrivileges.filter(p => p !== privilege));
        } else {
            setFormPrivileges([...safeFormPrivileges, privilege]);
        }
    };

    const handleToggleGroup = (groupPrivileges: string[], checked: boolean) => {
        if (checked) {
            const toAdd = groupPrivileges.filter(p => !safeFormPrivileges.includes(p));
            setFormPrivileges([...safeFormPrivileges, ...toAdd]);
        } else {
            setFormPrivileges(safeFormPrivileges.filter(p => !groupPrivileges.includes(p)));
        }
    };

    // Find any available privileges not mapped in PRIVILEGE_GROUPS
    const mappedPrivs = new Set(Object.values(PRIVILEGE_GROUPS).flat());
    const otherPrivs = safeAvailablePrivileges.filter(p => !mappedPrivs.has(p));

    const renderedGroups = {
        ...PRIVILEGE_GROUPS,
        ...(otherPrivs.length > 0 ? { "Other Privileges": otherPrivs } : {})
    };

    return (
        <Modal
            open={isModalOpen}
            handleClose={handleCloseModal}
            title={editingRole ? "Edit Role" : "Create Role"}
        >
            <form onSubmit={handleSubmit} className={styles.formContainer}>
                <div className={styles.row}>
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Role Name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                    />
                    <FormControl fullWidth className={styles.field}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={formStatus ? "true" : "false"}
                            label="Status"
                            onChange={(e) => setFormStatus(e.target.value === "true")}
                            sx={{ borderRadius: '8px' }}
                        >
                            <MenuItem value="true">Active</MenuItem>
                            <MenuItem value="false">Inactive</MenuItem>
                        </Select>
                    </FormControl>
                </div>
                
                <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 1 }}>
                        Permissions / Privileges (Grouped by Module)
                    </Typography>
                    
                    <Box sx={{ 
                        maxHeight: '400px', 
                        overflowY: 'auto', 
                        pr: 1.5,
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 2.5,
                        '&::-webkit-scrollbar': { width: '6px' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: '3px' }
                    }}>
                        {Object.entries(renderedGroups).map(([groupName, groupPrivs]) => {
                            const activeGroupPrivs = groupPrivs.filter(p => safeAvailablePrivileges.includes(p));
                            if (activeGroupPrivs.length === 0) return null;

                            const selectedInGroup = activeGroupPrivs.filter(p => safeFormPrivileges.includes(p));
                            const isAllSelected = selectedInGroup.length === activeGroupPrivs.length;
                            const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;

                            return (
                                <Paper 
                                    key={groupName} 
                                    variant="outlined" 
                                    sx={{ 
                                        p: 2, 
                                        borderRadius: '8px', 
                                        borderColor: '#e2e8f0',
                                        background: '#f8fafc'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                            {groupName}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={isAllSelected}
                                                    indeterminate={isSomeSelected}
                                                    onChange={(e) => handleToggleGroup(activeGroupPrivs, e.target.checked)}
                                                />
                                            }
                                            label={<span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Select All</span>}
                                            sx={{ margin: 0 }}
                                        />
                                    </Box>
                                    <Divider sx={{ mb: 1.5, borderColor: '#e2e8f0' }} />
                                    <Grid container spacing={1.5}>
                                        {activeGroupPrivs.map((priv) => (
                                            <Grid item xs={12} sm={6} key={priv}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={safeFormPrivileges.includes(priv)}
                                                            onChange={() => handleTogglePrivilege(priv)}
                                                        />
                                                    }
                                                    label={<span style={{ fontSize: '0.825rem', color: '#334155' }}>{priv}</span>}
                                                    sx={{ 
                                                        width: '100%',
                                                        margin: 0,
                                                        p: '2px 4px',
                                                        borderRadius: '4px',
                                                        '&:hover': { background: '#f1f5f9' }
                                                    }}
                                                />
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>

                <div className={styles.actions}>
                    <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">Save</Button>
                </div>
            </form>
        </Modal>
    )
}

export default RoleFormModal