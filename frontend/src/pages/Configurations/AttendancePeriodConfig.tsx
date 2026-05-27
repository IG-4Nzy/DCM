import { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Grid, Divider, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import request from '../../services/request';

interface ShiftInfo {
    name: string;
    startTime: string;
    endTime: string;
}

const AttendancePeriodConfig = () => {
    const [startDay, setStartDay] = useState<number>(1);
    const [endDay, setEndDay] = useState<number>(31);
    const [shiftStart, setShiftStart] = useState<string>('09:00');
    const [lateGracePeriod, setLateGracePeriod] = useState<number>(30);
    const [maxAllowedDays, setMaxAllowedDays] = useState<number>(26);
    const [shifts, setShifts] = useState<ShiftInfo[]>([]);
    const [trackedRole, setTrackedRole] = useState<string>('All Roles');
    const [roles, setRoles] = useState<string[]>(['All Roles']);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const response = await request.get('/api/attendance/config');
            if (response.data) {
                setStartDay(response.data.startDay || 1);
                setEndDay(response.data.endDay || 31);
                setShiftStart(response.data.shiftStart || '09:00');
                setLateGracePeriod(response.data.lateGracePeriod || 30);
                setMaxAllowedDays(response.data.maxAllowedDays || 26);
                setShifts(response.data.shifts || []);
                setTrackedRole(response.data.trackedRole || 'All Roles');
            }
        } catch (e: any) {
            showToast('Failed to load attendance configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await request.get('/api/roles', { params: { pagination: false } });
            if (response.data && response.data.data) {
                const roleNames = response.data.data.map((r: any) => r.name);
                setRoles(['All Roles', ...roleNames]);
            }
        } catch (e) {
            console.error('Failed to load roles list', e);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchRoles();
    }, []);

    const handleSave = async () => {
        if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
            showToast('Days must be between 1 and 31', 'warning');
            return;
        }
        if (maxAllowedDays < 1 || maxAllowedDays > 31) {
            showToast('Maximum allowed days must be between 1 and 31', 'warning');
            return;
        }

        // Validate shift entries
        for (const s of shifts) {
            if (!s.name.strip ? !s.name.trim() : !s.name) {
                showToast('Shift name cannot be empty', 'warning');
                return;
            }
        }

        setSaving(true);
        try {
            await request.post('/api/attendance/config', {
                startDay,
                endDay,
                shiftStart,
                lateGracePeriod: parseInt(lateGracePeriod.toString()),
                maxAllowedDays: parseInt(maxAllowedDays.toString()),
                shifts,
                trackedRole
            });
            showToast('Attendance configuration saved successfully', 'success');
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save attendance configuration', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ mt: 1, maxWidth: 850, pb: 4 }}>
            <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(8px)', background: 'rgba(255, 255, 255, 0.9)' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Attendance Calculation Period & Policy
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
                    Configure the start/end days of the monthly attendance tracking cycle, shift start timing, late grace periods, and maximum allowed working days per cycle.
                </Typography>
                
                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Typography variant="body2" color="textSecondary">Loading settings...</Typography>
                ) : (
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Cycle Start Day"
                                type="number"
                                fullWidth
                                inputProps={{ min: 1, max: 31 }}
                                value={startDay}
                                onChange={(e) => setStartDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                                disabled={!hasUpdate || saving}
                                helperText="Day of the month to start tracking"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Cycle End Day"
                                type="number"
                                fullWidth
                                inputProps={{ min: 1, max: 31 }}
                                value={endDay}
                                onChange={(e) => setEndDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                                disabled={!hasUpdate || saving}
                                helperText="Day of the month to end tracking"
                            />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <TextField
                                label="Standard Shift Start"
                                type="time"
                                fullWidth
                                value={shiftStart}
                                onChange={(e) => setShiftStart(e.target.value)}
                                disabled={!hasUpdate || saving}
                                InputLabelProps={{ shrink: true }}
                                helperText="Default work start time"
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Late Grace Period</InputLabel>
                                <Select
                                    value={lateGracePeriod}
                                    label="Late Grace Period"
                                    onChange={(e) => setLateGracePeriod(parseInt(e.target.value.toString()))}
                                    disabled={!hasUpdate || saving}
                                >
                                    <MenuItem value={30}>30 Minutes</MenuItem>
                                    <MenuItem value={60}>60 Minutes</MenuItem>
                                    <MenuItem value={90}>90 Minutes</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                label="Max Allowed Days"
                                type="number"
                                fullWidth
                                inputProps={{ min: 1, max: 31 }}
                                value={maxAllowedDays}
                                onChange={(e) => setMaxAllowedDays(Math.max(1, Math.min(31, parseInt(e.target.value) || 26)))}
                                disabled={!hasUpdate || saving}
                                helperText="Maximum target days per cycle (e.g. 26)"
                            />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Track Attendance For Role</InputLabel>
                                <Select
                                    value={trackedRole}
                                    label="Track Attendance For Role"
                                    onChange={(e) => setTrackedRole(e.target.value as string)}
                                    disabled={!hasUpdate || saving}
                                >
                                    {roles.map((r, idx) => (
                                        <MenuItem key={idx} value={r}>{r}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#333' }}>
                                    Manage Roster Shifts (At least 4 shifts supported)
                                </Typography>
                                {hasUpdate && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setShifts([...shifts, { name: '', startTime: '09:00', endTime: '17:00' }])}
                                        disabled={saving}
                                    >
                                        + Add Shift
                                    </Button>
                                )}
                            </Box>
                            
                            {shifts.length === 0 ? (
                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                                    No custom shifts added yet. Standard shift start will apply to all roster logs.
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                                    {shifts.map((shift, idx) => (
                                        <Grid container spacing={2} key={idx} alignItems="center">
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    label="Shift Name"
                                                    placeholder="e.g. Morning Shift"
                                                    fullWidth
                                                    value={shift.name}
                                                    onChange={(e) => {
                                                        const newShifts = [...shifts];
                                                        newShifts[idx].name = e.target.value;
                                                        setShifts(newShifts);
                                                     }}
                                                    disabled={!hasUpdate || saving}
                                                />
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <TextField
                                                    label="Start Time"
                                                    type="time"
                                                    fullWidth
                                                    value={shift.startTime}
                                                    onChange={(e) => {
                                                        const newShifts = [...shifts];
                                                        newShifts[idx].startTime = e.target.value;
                                                        setShifts(newShifts);
                                                    }}
                                                    disabled={!hasUpdate || saving}
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <TextField
                                                    label="End Time"
                                                    type="time"
                                                    fullWidth
                                                    value={shift.endTime}
                                                    onChange={(e) => {
                                                        const newShifts = [...shifts];
                                                        newShifts[idx].endTime = e.target.value;
                                                        setShifts(newShifts);
                                                    }}
                                                    disabled={!hasUpdate || saving}
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={2}>
                                                {hasUpdate && (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        fullWidth
                                                        onClick={() => {
                                                            const newShifts = shifts.filter((_, sIdx) => sIdx !== idx);
                                                            setShifts(newShifts);
                                                        }}
                                                        disabled={saving}
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </Grid>
                                        </Grid>
                                    ))}
                                </Box>
                            )}
                        </Grid>

                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {hasUpdate && (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleSave}
                                        loading={saving}
                                    >
                                        Save Configuration
                                    </Button>
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                )}
            </Paper>
        </Box>
    );
};

export default AttendancePeriodConfig;
