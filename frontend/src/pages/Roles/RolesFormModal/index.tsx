// @ts-nocheck
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
    formLateLoginPrivileges: string[];
    setFormLateLoginPrivileges: (value: string[]) => void;
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
        "Delete Server Ping Monitoring",
        "view_own_vcenter_vm_monitoring",
        "Create vCenter Appliance",
        "Update vCenter Appliance",
        "Delete vCenter Appliance"
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
        "View All Roaster",
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
        "View All Department Works",
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
    ],
    "Network & Phone": [
        "View IP List",
        "Create IP List",
        "Update IP List",
        "Delete IP List",
        "View Phone Directory",
        "Create Phone Directory",
        "Update Phone Directory",
        "Delete Phone Directory"
    ],
    "Salary Calculation": [
        "View Salary Calculation",
        "Create Salary Calculation",
        "Update Salary Calculation",
        "Calculate Salary",
        "Delete Salary Calculation"
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
    formLateLoginPrivileges = [],
    setFormLateLoginPrivileges,
    availablePrivileges = [],
    handleSubmit
}: PropType) => {
    const [searchQuery, setSearchQuery] = React.useState('');

    const safeFormPrivileges = formPrivileges || [];
    const safeFormLateLoginPrivileges = formLateLoginPrivileges || [];
    const safeAvailablePrivileges = availablePrivileges || [];

    const handleTogglePrivilege = (privilege: string) => {
        if (safeFormPrivileges.includes(privilege)) {
            setFormPrivileges(safeFormPrivileges.filter(p => p !== privilege));
            setFormLateLoginPrivileges(safeFormLateLoginPrivileges.filter(p => p !== privilege));
        } else {
            setFormPrivileges([...safeFormPrivileges, privilege]);
        }
    };

    const handleToggleLateLoginPrivilege = (privilege: string) => {
        if (safeFormLateLoginPrivileges.includes(privilege)) {
            setFormLateLoginPrivileges(safeFormLateLoginPrivileges.filter(p => p !== privilege));
        } else {
            setFormLateLoginPrivileges([...safeFormLateLoginPrivileges, privilege]);
        }
    };

    const handleToggleGroup = (groupPrivileges: string[], checked: boolean) => {
        if (checked) {
            const toAdd = groupPrivileges.filter(p => !safeFormPrivileges.includes(p));
            setFormPrivileges([...safeFormPrivileges, ...toAdd]);
        } else {
            setFormPrivileges(safeFormPrivileges.filter(p => !groupPrivileges.includes(p)));
            setFormLateLoginPrivileges(safeFormLateLoginPrivileges.filter(p => !groupPrivileges.includes(p)));
        }
    };

    // Find any available privileges not mapped in PRIVILEGE_GROUPS
    const mappedPrivs = new Set(Object.values(PRIVILEGE_GROUPS).flat());
    const otherPrivs = safeAvailablePrivileges.filter(p => !mappedPrivs.has(p));

    const renderedGroups = {
        ...PRIVILEGE_GROUPS,
        ...(otherPrivs.length > 0 ? { "Other Privileges": otherPrivs } : {})
    };

    const searchLower = searchQuery.trim().toLowerCase();

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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                            Permissions / Privileges (Grouped by Module)
                        </Typography>
                        <TextField
                            placeholder="Search privileges..."
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{ minWidth: 220, '& .MuiInputBase-input': { fontSize: '13px', py: '6px' } }}
                        />
                    </Box>

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
                            const filteredGroupPrivs = activeGroupPrivs.filter(p =>
                                !searchLower || p.toLowerCase().includes(searchLower) || groupName.toLowerCase().includes(searchLower)
                            );
                            if (filteredGroupPrivs.length === 0) return null;

                            const selectedInGroup = filteredGroupPrivs.filter(p => safeFormPrivileges.includes(p));
                            const isAllSelected = selectedInGroup.length === filteredGroupPrivs.length;
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
                                                    onChange={(e) => handleToggleGroup(filteredGroupPrivs, e.target.checked)}
                                                />
                                            }
                                            label={<span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Select All</span>}
                                            sx={{ margin: 0 }}
                                        />
                                    </Box>
                                    <Divider sx={{ mb: 1.5, borderColor: '#e2e8f0' }} />
                                    <Grid container spacing={1.5}>
                                        {filteredGroupPrivs.map((priv) => (
                                            <Grid size={{ xs: 12, sm: 6 }} key={priv}>
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between', 
                                                    width: '100%',
                                                    borderRadius: '4px',
                                                    '&:hover': { background: '#f1f5f9' }
                                                }}>
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
                                                            margin: 0,
                                                            p: '2px 4px',
                                                            flexGrow: 1
                                                        }}
                                                    />
                                                    {safeFormPrivileges.includes(priv) && (
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={safeFormLateLoginPrivileges.includes(priv)}
                                                                    onChange={() => handleToggleLateLoginPrivilege(priv)}
                                                                    sx={{ color: '#ec4899', '&.Mui-checked': { color: '#db2777' } }}
                                                                />
                                                            }
                                                            label={<span style={{ fontSize: '0.725rem', fontWeight: 600, color: '#db2777' }}>Late Login</span>}
                                                            sx={{ margin: 0, mr: 1 }}
                                                        />
                                                    )}
                                                </Box>
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