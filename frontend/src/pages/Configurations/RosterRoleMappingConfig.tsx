// @ts-nocheck
import { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Divider, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import request from '../../services/request';

interface RoleOption {
    id: string;
    name: string;
}

interface DepartmentOption {
    id: string;
    name: string;
}

interface Mapping {
    _id?: string;
    roleId: string;
    roleName: string;
    departmentId: string;
    departmentName: string;
}

const RosterRoleMappingConfig = () => {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [departments, setDepartments] = useState<DepartmentOption[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [mappingsRes, rolesRes, deptsRes] = await Promise.all([
                request.get('/api/roasters/role-mappings'),
                request.get('/api/roles', { params: { pagination: false } }),
                request.get('/api/departments', { params: { pagination: false } })
            ]);

            setMappings(mappingsRes.data || []);
            
            if (rolesRes.data && rolesRes.data.data) {
                setRoles(rolesRes.data.data.map((r: any) => ({
                    id: r.id || r._id,
                    name: r.name
                })));
            }

            if (deptsRes.data && deptsRes.data.data) {
                setDepartments(deptsRes.data.data.map((d: any) => ({
                    id: d.id || d._id,
                    name: d.name
                })));
            }
        } catch (e: any) {
            showToast('Failed to load roster mapping configuration data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddMapping = async () => {
        if (!selectedRoleId || !selectedDepartmentId) {
            showToast('Please select both a role and a department', 'warning');
            return;
        }

        const role = roles.find(r => r.id === selectedRoleId);
        const dept = departments.find(d => d.id === selectedDepartmentId);

        if (!role || !dept) {
            showToast('Invalid role or department selected', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                roleId: role.id,
                roleName: role.name,
                departmentId: dept.id,
                departmentName: dept.name
            };

            await request.post('/api/roasters/role-mappings', payload);
            showToast('Roster role mapping saved successfully', 'success');
            setSelectedRoleId('');
            setSelectedDepartmentId('');
            fetchData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save roster role mapping', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMapping = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this mapping?')) {
            return;
        }

        try {
            await request.delete(`/api/roasters/role-mappings/${id}`);
            showToast('Mapping deleted successfully', 'success');
            fetchData();
        } catch (e: any) {
            showToast('Failed to delete mapping', 'error');
        }
    };

    return (
        <Box sx={{ mt: 1, maxWidth: 850, pb: 4 }}>
            <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(8px)', background: 'rgba(255, 255, 255, 0.9)' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Role-wise Default Roster Mapping
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
                    Configure default department roster views for specific user roles. Users in these roles with roster privileges will default to and be restricted to their mapped department's rosters on both the roster page and the dashboard.
                </Typography>
                
                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Typography variant="body2" color="textSecondary">Loading mapping settings...</Typography>
                ) : (
                    <Box>
                        {hasUpdate && (
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#444', mb: 2 }}>
                                    Add New Mapping
                                </Typography>
                                <Grid container spacing={3} alignItems="center">
                                    <Grid item xs={12} sm={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Select Role</InputLabel>
                                            <Select
                                                value={selectedRoleId}
                                                label="Select Role"
                                                onChange={(e) => setSelectedRoleId(e.target.value)}
                                                disabled={saving}
                                            >
                                                {roles.map((r) => (
                                                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Select Department</InputLabel>
                                            <Select
                                                value={selectedDepartmentId}
                                                label="Select Department"
                                                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                                                disabled={saving}
                                            >
                                                {departments.map((d) => (
                                                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            fullWidth
                                            onClick={handleAddMapping}
                                            loading={saving}
                                        >
                                            Add Mapping
                                        </Button>
                                    </Grid>
                                </Grid>
                                <Divider sx={{ my: 4 }} />
                            </Box>
                        )}

                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#444', mb: 2 }}>
                            Active Mappings
                        </Typography>

                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead sx={{ backgroundColor: '#f9f9f9' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Role Name</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Mapped Department</TableCell>
                                        {hasUpdate && <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {mappings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={hasUpdate ? 3 : 2} align="center" sx={{ py: 3, color: '#888', fontStyle: 'italic' }}>
                                                No roster role mappings configured.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        mappings.map((mapping) => (
                                            <TableRow key={mapping._id || mapping.roleId}>
                                                <TableCell>{mapping.roleName}</TableCell>
                                                <TableCell>{mapping.departmentName}</TableCell>
                                                {hasUpdate && (
                                                    <TableCell align="right">
                                                        <IconButton
                                                            color="error"
                                                            size="small"
                                                            onClick={() => handleDeleteMapping(mapping._id)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default RosterRoleMappingConfig;
