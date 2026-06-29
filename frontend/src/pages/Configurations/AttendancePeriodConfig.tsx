// @ts-nocheck
import { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Grid, Divider, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch } from '@mui/material';
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

interface RosterRow {
    name: string;
    mappedShift: string;
}

const AttendancePeriodConfig = () => {
    const [startDay, setStartDay] = useState<number | string>(1);
    const [endDay, setEndDay] = useState<number | string>(31);
    const [shiftStart, setShiftStart] = useState<string>('09:00');
    const [lateGracePeriod, setLateGracePeriod] = useState<number | string>(30);
    const [maxAllowedDays, setMaxAllowedDays] = useState<number | string>(26);
    const [shifts, setShifts] = useState<ShiftInfo[]>([]);
    const [rosterRows, setRosterRows] = useState<RosterRow[]>([]);
    const [trackedRole, setTrackedRole] = useState<string>('All Roles');
    const [roles, setRoles] = useState<string[]>(['All Roles']);
    const [lateLoginRestriction, setLateLoginRestriction] = useState<boolean>(true);
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
                setRosterRows(response.data.rosterRows || []);
                setTrackedRole(response.data.trackedRole || 'All Roles');
                setLateLoginRestriction(response.data.lateLoginRestriction !== undefined ? response.data.lateLoginRestriction : true);
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
        if (lateGracePeriod === '' || isNaN(parseInt(lateGracePeriod.toString())) || parseInt(lateGracePeriod.toString()) < 0) {
            showToast('Late grace period must be a valid positive number', 'warning');
            return;
        }

        // Validate shift entries
        for (const s of shifts) {
            if (!s.name || !s.name.trim()) {
                showToast('Shift name cannot be empty', 'warning');
                return;
            }
        }

        // Validate roster row entries
        for (const r of rosterRows) {
            if (!r.name || !r.name.trim()) {
                showToast('Roster row name cannot be empty', 'warning');
                return;
            }
            if (!r.mappedShift) {
                showToast('Please assign a shift to all roster rows', 'warning');
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
                trackedRole,
                rosterRows,
                lateLoginRestriction
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
                        <Grid size={{xs: 12, sm: 6}}   >
                            <TextField
                                label="Cycle Start Day"
                                type="number"
                                fullWidth
                                slotProps={{ htmlInput: { min: 1, max: 31 } }}
                                value={startDay}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setStartDay('');
                                    } else {
                                        const parsedVal = parseInt(val);
                                        if (!isNaN(parsedVal)) {
                                            setStartDay(Math.max(1, Math.min(31, parsedVal)));
                                        }
                                    }
                                }}
                                disabled={!hasUpdate || saving}
                                helperText="Day of the month to start tracking"
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 6}}   >
                            <TextField
                                label="Cycle End Day"
                                type="number"
                                fullWidth
                                slotProps={{ htmlInput: { min: 1, max: 31 } }}
                                value={endDay}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setEndDay('');
                                    } else {
                                        const parsedVal = parseInt(val);
                                        if (!isNaN(parsedVal)) {
                                            setEndDay(Math.max(1, Math.min(31, parsedVal)));
                                        }
                                    }
                                }}
                                disabled={!hasUpdate || saving}
                                helperText="Day of the month to end tracking"
                            />
                        </Grid>

                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                label="Standard Shift Start"
                                type="time"
                                fullWidth
                                value={shiftStart}
                                onChange={(e) => setShiftStart(e.target.value)}
                                disabled={!hasUpdate || saving}
                                slotProps={{ inputLabel: { shrink: true } }}
                                helperText="Default work start time"
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                label="Late Grace Period (Minutes)"
                                type="number"
                                fullWidth
                                slotProps={{ htmlInput: { min: 0 } }}
                                value={lateGracePeriod}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setLateGracePeriod('');
                                    } else {
                                        const parsedVal = parseInt(val);
                                        if (!isNaN(parsedVal)) {
                                            setLateGracePeriod(Math.max(0, parsedVal));
                                        }
                                    }
                                }}
                                disabled={!hasUpdate || saving}
                                helperText="Allowed minutes before marked late"
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                label="Max Allowed Days"
                                type="number"
                                fullWidth
                                slotProps={{ htmlInput: { min: 1, max: 31 } }}
                                value={maxAllowedDays}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setMaxAllowedDays('');
                                    } else {
                                        const parsedVal = parseInt(val);
                                        if (!isNaN(parsedVal)) {
                                            setMaxAllowedDays(Math.max(1, Math.min(31, parsedVal)));
                                        }
                                    }
                                }}
                                disabled={!hasUpdate || saving}
                                helperText="Maximum target days per cycle (e.g. 26)"
                            />
                        </Grid>

                        <Grid size={{xs: 12, sm: 6}}   >
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

                        <Grid size={{xs: 12, sm: 6}}   >
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={lateLoginRestriction}
                                        onChange={(e) => setLateLoginRestriction(e.target.checked)}
                                        disabled={!hasUpdate || saving}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            Restrict Late Logins
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            If enabled, users are blocked from logging in if they are late. If disabled, they are allowed to log in but marked as late.
                                        </Typography>
                                    </Box>
                                }
                                sx={{ mt: 0.5 }}
                            />
                        </Grid>

                        <Grid size={{xs: 12}}  >
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
                                        <Grid container spacing={2} key={idx}  sx={{ alignItems: 'center' }} >
                                            <Grid size={{xs: 12, sm: 4}}   >
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
                                            <Grid size={{xs: 6, sm: 3}}   >
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
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 6, sm: 3}}   >
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
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 12, sm: 2}}   >
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
                        
                        <Grid size={{xs: 12}}  >
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#333' }}>
                                    Manage Roster Rows / Slots (Assign shifts to each row/slot)
                                </Typography>
                                {hasUpdate && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setRosterRows([...rosterRows, { name: '', mappedShift: 'None' }])}
                                        disabled={saving}
                                    >
                                        + Add Row/Slot
                                    </Button>
                                )}
                            </Box>
                            
                            {rosterRows.length === 0 ? (
                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                                    No custom roster rows configured yet. Standard rows (Shift-1 Row-1, Shift-1 Row-2, Shift-2 Row-1...) will apply.
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                                    {rosterRows.map((row, idx) => (
                                        <Grid container spacing={2} key={idx}  sx={{ alignItems: 'center' }} >
                                            <Grid size={{xs: 12, sm: 5}}   >
                                                <TextField
                                                    label="Row / Slot Name"
                                                    placeholder="e.g. Shift 1 Row 1"
                                                    fullWidth
                                                    value={row.name}
                                                    onChange={(e) => {
                                                        const newRows = [...rosterRows];
                                                        newRows[idx].name = e.target.value;
                                                        setRosterRows(newRows);
                                                    }}
                                                    disabled={!hasUpdate || saving}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 12, sm: 5}}   >
                                                <FormControl fullWidth>
                                                    <InputLabel>Mapped Shift</InputLabel>
                                                    <Select
                                                        value={row.mappedShift}
                                                        label="Mapped Shift"
                                                        onChange={(e) => {
                                                            const newRows = [...rosterRows];
                                                            newRows[idx].mappedShift = e.target.value as string;
                                                            setRosterRows(newRows);
                                                        }}
                                                        disabled={!hasUpdate || saving}
                                                    >
                                                        <MenuItem value="None">None</MenuItem>
                                                        {shifts.map((s, sIdx) => (
                                                            <MenuItem key={sIdx} value={s.name}>{s.name}</MenuItem>
                                                        ))}
                                                        <MenuItem value="Leave">Leave</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid size={{xs: 12, sm: 2}}   >
                                                {hasUpdate && (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        fullWidth
                                                        onClick={() => {
                                                            const newRows = rosterRows.filter((_, rIdx) => rIdx !== idx);
                                                            setRosterRows(newRows);
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

                        <Grid size={{xs: 12}}   sx={{ mt: 2 }}>
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

