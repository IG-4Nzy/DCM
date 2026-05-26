import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, MenuItem, Select, FormControl, InputLabel, Grid,
    Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Chip, LinearProgress, Tabs, Tab
} from '@mui/material';
import {
    MdCheck as ApproveIcon,
    MdClose as RejectIcon,
    MdSend as SubmitIcon,
    MdEdit as EditIcon
} from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import request from '../../services/request';
import dayjs from 'dayjs';

interface AttendanceRecord {
    id: string;
    username: string;
    fullName?: string;
    department: string;
    date: string;
    firstLogin: string | null;
    lastLogout: string | null;
    workedHours: number;
    regularizeStatus: string;
    regularizeReason: string | null;
    regularizeRemarks: string | null;
}

interface PeriodOption {
    label: string;
    startDate: string;
    endDate: string;
}

interface SummaryRecord {
    username: string;
    fullName: string;
    department: string;
    presentDays: number;
    lateDays: number;
    maxDays: number;
}

const Attendance: React.FC = () => {
    const [data, setData] = useState<AttendanceRecord[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [cycleConfig, setCycleConfig] = useState({ 
        startDay: 1, 
        endDay: 31,
        shiftStart: '09:00',
        lateGracePeriod: 30,
        maxAllowedDays: 26
    });
    const [periods, setPeriods] = useState<PeriodOption[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    const [departments, setDepartments] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    
    // Summary tab state
    const [activeTab, setActiveTab] = useState(0);
    const [summaryData, setSummaryData] = useState<SummaryRecord[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    
    // Regularization Modal State
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [regReason, setRegReason] = useState('');
    const [regRemarks, setRegRemarks] = useState('');
    const [submittingReg, setSubmittingReg] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [editLogin, setEditLogin] = useState('09:00');
    const [editLogout, setEditLogout] = useState('17:00');
    const [editDate, setEditDate] = useState('');
    const [editHours, setEditHours] = useState(8);
    const [editStatus, setEditStatus] = useState('None');
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Calendar Modal State
    const [isCalModalOpen, setIsCalModalOpen] = useState(false);
    const [calEmployee, setCalEmployee] = useState<SummaryRecord | null>(null);
    const [calLogs, setCalLogs] = useState<AttendanceRecord[]>([]);
    const [calRosters, setCalRosters] = useState<any[]>([]);
    const [loadingCal, setLoadingCal] = useState(false);

    // Current Logged In User Info
    const { username, isSuperuser, department: userDept } = useSelector((state: RootState) => state.auth);
    const hasViewAll = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_ALL_ATTENDACE);
    const hasViewDept = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_DEPARTMENTAL_ATTENDACE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.ATTENDANCE_DELETE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.ATTENDANCE_UPDATE);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // 1. Fetch Cycle Configuration & Build Dynamic Periods
    const loadCycleConfig = useCallback(async () => {
        try {
            const res = await request.get('/api/attendance/config');
            const config = res.data || { startDay: 1, endDay: 31 };
            setCycleConfig(config);

            // Generate past 6 months periods based on configuration
            const options: PeriodOption[] = [];
            const startDay = config.startDay;
            const endDay = config.endDay;

            // Generate monthly cycles
            for (let i = -3; i <= 2; i++) {
                const currentMonth = dayjs().add(i, 'months');
                let startMoment, endMoment;

                if (startDay === 1) {
                    startMoment = currentMonth.startOf('month');
                    endMoment = currentMonth.endOf('month');
                } else {
                    // E.g., if startDay = 20, cycle starts 20th of prev month to 21st of current month
                    startMoment = currentMonth.subtract(1, 'month').date(startDay);
                    endMoment = currentMonth.date(endDay);
                }

                options.push({
                    label: `${startMoment.format('MMM DD, YYYY')} - ${endMoment.format('MMM DD, YYYY')}`,
                    startDate: startMoment.format('YYYY-MM-DD'),
                    endDate: endMoment.format('YYYY-MM-DD')
                });
            }

            setPeriods(options);

            // Find current active period and select it by default
            const today = dayjs().format('YYYY-MM-DD');
            const currentPeriod = options.find(p => today >= p.startDate && today <= p.endDate);
            if (currentPeriod) {
                setSelectedPeriod(currentPeriod.label);
            } else if (options.length > 0) {
                setSelectedPeriod(options[2].label); // default fallback middle period
            }
        } catch (e: any) {
            showToast('Failed to load cycle configuration', 'error');
        }
    }, [showToast]);

    // 2. Fetch Departments List (for Filter Dropdown)
    const loadDepartments = useCallback(async () => {
        try {
            const res = await request.get('/api/departments', {
                params: { pagination: false }
            });
            if (res.data && res.data.data) {
                setDepartments(res.data.data.map((d: any) => d.name));
            }
        } catch (e) {
            // Silently fail or ignore if not allowed
        }
    }, []);

    // 3. Load Attendance Logs
    const loadAttendance = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const period = periods.find(p => p.label === selectedPeriod);
            
            const params: any = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true
            };

            if (period) {
                params.startDate = period.startDate;
                params.endDate = period.endDate;
            }

            if (hasViewAll && departmentFilter) {
                params.department = departmentFilter;
            }

            const response = await request.get('/api/attendance/', {
                params
            });

            setData(response.data.data);
            setTotalCount(response.data.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to fetch attendance logs', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, selectedPeriod, departmentFilter, periods, hasViewAll, showToast]);

    const loadSummary = useCallback(async () => {
        setLoadingSummary(true);
        try {
            const period = periods.find(p => p.label === selectedPeriod);
            const params: any = {};
            if (period) {
                params.startDate = period.startDate;
                params.endDate = period.endDate;
            }
            if (hasViewAll && departmentFilter) {
                params.department = departmentFilter;
            }
            const res = await request.get('/api/attendance/summary', { params });
            setSummaryData(res.data || []);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to fetch attendance summary', 'error');
        } finally {
            setLoadingSummary(false);
        }
    }, [selectedPeriod, departmentFilter, periods, hasViewAll, showToast]);

    useEffect(() => {
        loadCycleConfig();
        loadDepartments();
    }, [loadCycleConfig, loadDepartments]);

    useEffect(() => {
        if (periods.length > 0 && selectedPeriod) {
            loadAttendance();
            loadSummary();
        }
    }, [periods, selectedPeriod, page, rowsPerPage, searchQuery, departmentFilter, loadAttendance, loadSummary]);

    // Actions
    const handleOpenRegModal = (row: AttendanceRecord) => {
        setSelectedRecord(row);
        setRegReason('');
        setRegRemarks('');
        setIsRegModalOpen(true);
    };

    const handleCloseRegModal = () => {
        setIsRegModalOpen(false);
        setSelectedRecord(null);
    };

    const handleSubmitRegularization = async () => {
        if (!regReason.trim()) {
            showToast('Reason is required', 'warning');
            return;
        }

        setSubmittingReg(true);
        try {
            await request.post(`/api/attendance/regularize/${selectedRecord?.id}`, {
                reason: regReason,
                remarks: regRemarks
            });
            showToast('Regularization request submitted successfully', 'success');
            handleCloseRegModal();
            loadAttendance();
            loadSummary();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to submit regularization', 'error');
        } finally {
            setSubmittingReg(false);
        }
    };

    const handleApprove = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to approve regularization for ${row.username} on ${row.date}?`, 'Approve Regularization');
        if (isConfirmed) {
            try {
                await request.post(`/api/attendance/approve/${row.id}`);
                showToast('Regularization request approved', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to approve regularization', 'error');
            }
        }
    };

    const handleReject = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to reject regularization for ${row.username} on ${row.date}?`, 'Reject Regularization');
        if (isConfirmed) {
            try {
                await request.post(`/api/attendance/reject/${row.id}`, {
                    remarks: "Rejected by Department Head"
                });
                showToast('Regularization request rejected', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to reject regularization', 'error');
            }
        }
    };

    const handleDelete = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to delete attendance record for ${row.username} on ${row.date}?`, 'Delete Attendance Log');
        if (isConfirmed) {
            try {
                await request.delete(`/api/attendance/${row.id}`);
                showToast('Attendance log deleted successfully', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete attendance log', 'error');
            }
        }
    };

    const handleOpenEditModal = (row: AttendanceRecord) => {
        setEditingRecord(row);
        setEditLogin(row.firstLogin ? dayjs(row.firstLogin).format('HH:mm') : '09:00');
        setEditLogout(row.lastLogout ? dayjs(row.lastLogout).format('HH:mm') : '17:00');
        setEditDate(row.date);
        setEditHours(row.workedHours);
        setEditStatus(row.regularizeStatus);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingRecord(null);
    };

    const handleSaveEdit = async () => {
        if (!editingRecord) return;
        setSubmittingEdit(true);
        try {
            const firstLoginIso = `${editDate}T${editLogin}:00`;
            const lastLogoutIso = `${editDate}T${editLogout}:00`;

            await request.put(`/api/attendance/${editingRecord.id}`, {
                firstLogin: firstLoginIso,
                lastLogout: lastLogoutIso,
                workedHours: parseFloat(editHours.toString()) || 0.0,
                regularizeStatus: editStatus
            });

            showToast('Attendance record updated successfully', 'success');
            handleCloseEditModal();
            loadAttendance();
            loadSummary();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to update attendance record', 'error');
        } finally {
            setSubmittingEdit(false);
        }
    };

    const handleOpenCalendar = async (employee: SummaryRecord) => {
        setCalEmployee(employee);
        setIsCalModalOpen(true);
        setCalLogs([]);
        setCalRosters([]);
        setLoadingCal(true);
        try {
            const period = periods.find(p => p.label === selectedPeriod);
            const params: any = {
                username: employee.username,
                pagination: false
            };
            if (period) {
                params.startDate = period.startDate;
                params.endDate = period.endDate;
            }
            const [attRes, rosterRes] = await Promise.all([
                request.get('/api/attendance/', { params }),
                request.get('/api/roasters/', { params: period ? { startDate: period.startDate, endDate: period.endDate } : {} })
            ]);
            setCalLogs(attRes.data.data || []);
            setCalRosters(rosterRes.data.data || []);
        } catch (e: any) {
            showToast('Failed to load employee attendance logs', 'error');
        } finally {
            setLoadingCal(false);
        }
    };

    const handleCloseCalendar = () => {
        setIsCalModalOpen(false);
        setCalEmployee(null);
        setCalLogs([]);
        setCalRosters([]);
    };

    // Table Column Definitions
    const columns: Column<AttendanceRecord>[] = [
        {
            id: 'date',
            label: 'Date',
            sortable: true,
            render: (row) => dayjs(row.date).format('MMM DD, YYYY')
        },
        { 
            id: 'fullName', 
            label: 'Employee', 
            sortable: true,
            render: (row) => row.fullName || row.username 
        },
        { id: 'department', label: 'Department', sortable: true },
        {
            id: 'firstLogin',
            label: 'First Login',
            sortable: false,
            render: (row) => {
                if (!row.firstLogin) return '-';
                const timeStr = dayjs(row.firstLogin).format('hh:mm A');
                
                // Determine if late
                const loginTime = dayjs(row.firstLogin);
                const [sh, sm] = (cycleConfig.shiftStart || '09:00').split(':').map(Number);
                const grace = cycleConfig.lateGracePeriod || 30;
                
                const threshold = loginTime.hour(sh).minute(sm).add(grace, 'minute');
                const isLate = loginTime.isAfter(threshold);
                
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: isLate ? '#d32f2f' : 'inherit', fontWeight: isLate ? 600 : 'normal', fontSize: '0.875rem' }}>
                            {timeStr}
                        </Typography>
                        {isLate && (
                            <Chip 
                                label="Late" 
                                size="small" 
                                sx={{ 
                                    height: 18, 
                                    fontSize: '10px', 
                                    backgroundColor: '#ffebee', 
                                    color: '#c62828', 
                                    fontWeight: 600 
                                }} 
                            />
                        )}
                    </Box>
                );
            }
        },
        {
            id: 'lastLogout',
            label: 'Last Logout',
            sortable: false,
            render: (row) => row.lastLogout ? dayjs(row.lastLogout).format('hh:mm A') : '-'
        },
        {
            id: 'workedHours',
            label: 'Worked Hours',
            sortable: true,
            render: (row) => {
                const hours = row.workedHours;
                const isUnder8 = hours < 8;
                return (
                    <Box sx={{ width: '100%', minWidth: 120 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: isUnder8 ? '#d32f2f' : '#2e7d32' }}>
                                {hours} hrs
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                {isUnder8 ? 'Shortage' : 'Completed'}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, (hours / 8) * 100)}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: 'rgba(0,0,0,0.06)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: isUnder8 ? '#ef5350' : '#4caf50'
                                }
                            }}
                        />
                    </Box>
                );
            }
        },
        {
            id: 'regularizeStatus',
            label: 'Regularization',
            sortable: true,
            render: (row) => {
                const status = row.regularizeStatus;
                if (status === 'Pending') {
                    return <Chip label="Pending Approval" size="small" sx={{ backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 600 }} />;
                } else if (status === 'Approved') {
                    return <Chip label="Regularized" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} />;
                } else if (status === 'Rejected') {
                    return <Chip label="Rejected" size="small" sx={{ backgroundColor: '#ffebee', color: '#c62828', fontWeight: 600 }} />;
                }
                return row.workedHours < 8 ? (
                    <Button
                        variant="outlined"
                        size="small"
                        color="secondary"
                        startIcon={<SubmitIcon />}
                        onClick={() => handleOpenRegModal(row)}
                        sx={{ fontSize: '11px', py: 0.5 }}
                    >
                        Regularize
                    </Button>
                ) : (
                    <Typography variant="body2" color="textSecondary">-</Typography>
                );
            }
        },
        {
            id: 'id',
            label: 'Actions',
            align: 'right',
            sortable: false,
            render: (row) => {
                const isPending = row.regularizeStatus === 'Pending';
                
                // Regularization can be approved by Department Head or Superuser
                // Department head handles requests from their department
                const canApprove = isSuperuser || (userDept === row.department);

                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {hasUpdate && (
                            <Tooltip title="Edit Attendance Log">
                                <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.06)' }} onClick={() => handleOpenEditModal(row)}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {isPending && canApprove && (
                            <>
                                <Tooltip title="Approve Request">
                                    <IconButton size="small" color="success" sx={{ backgroundColor: 'rgba(46, 125, 50, 0.06)' }} onClick={() => handleApprove(row)}>
                                        <ApproveIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject Request">
                                    <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(198, 40, 40, 0.06)' }} onClick={() => handleReject(row)}>
                                        <RejectIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        {hasDelete && (
                            <Tooltip title="Delete Attendance Log">
                                <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                                    <RejectIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            }
        }
    ];

    const summaryColumns: Column<SummaryRecord>[] = [
        { 
            id: 'fullName', 
            label: 'Employee', 
            sortable: true,
            render: (row) => row.fullName || row.username
        },
        { id: 'department', label: 'Department', sortable: true },
        {
            id: 'presentDays',
            label: 'Present Days / Target',
            sortable: true,
            render: (row) => {
                const percentage = Math.min(100, (row.presentDays / row.maxDays) * 100);
                return (
                    <Box sx={{ width: '100%', minWidth: 150 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                           <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                               {row.presentDays} / {row.maxDays} days
                           </Typography>
                           <Typography variant="caption" color="textSecondary">
                               {percentage.toFixed(0)}%
                           </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: 'rgba(0,0,0,0.06)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#3f51b5'
                                }
                            }}
                        />
                    </Box>
                );
            }
        },
        {
            id: 'lateDays',
            label: 'Late Days Count',
            sortable: true,
            render: (row) => (
                <Chip
                    label={`${row.lateDays} Late Day(s)`}
                    size="small"
                    sx={{
                        backgroundColor: row.lateDays > 0 ? '#ffebee' : '#e8f5e9',
                        color: row.lateDays > 0 ? '#c62828' : '#2e7d32',
                        fontWeight: 600
                    }}
                />
            )
        },
        {
            id: 'username',
            label: 'Detailed View',
            align: 'right',
            sortable: false,
            render: (row) => (
                <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    onClick={() => handleOpenCalendar(row)}
                    sx={{ fontSize: '11px', py: 0.5, textTransform: 'none', fontWeight: 600 }}
                >
                    View Calendar
                </Button>
            )
        }
    ];

    return (
        <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#333', mb: 0.5 }}>
                        Attendance Logs
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        View timings, track active duration, and manage regularization requests.
                    </Typography>
                </Box>
            </Box>

            {/* Filter Bar */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                            <InputLabel>Calculation Period</InputLabel>
                            <Select
                                value={selectedPeriod}
                                label="Calculation Period"
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                {periods.map((p, idx) => (
                                    <MenuItem key={idx} value={p.label}>{p.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    {hasViewAll && (
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Department Filter</InputLabel>
                                <Select
                                    value={departmentFilter}
                                    label="Department Filter"
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Departments</MenuItem>
                                    {departments.map((dept, idx) => (
                                        <MenuItem key={idx} value={dept}>{dept}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    )}
                    <Grid item xs={12} sm={hasViewAll ? 4 : 8}>
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search employee..."
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Tabs for switching between Logs and summary counts */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} textColor="primary" indicatorColor="primary">
                    <Tab label="Attendance Logs" sx={{ fontWeight: 600 }} />
                    <Tab label="Employee Attendance Summary" sx={{ fontWeight: 600 }} />
                </Tabs>
            </Box>

            {activeTab === 0 ? (
                /* Logs Table */
                <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                    <Table
                        columns={columns}
                        data={data}
                        totalCount={totalCount}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={(e, p) => setPage(p)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        loading={loading}
                    />
                </Paper>
            ) : (
                /* Employee Summary Table */
                <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                    <Table
                        columns={summaryColumns}
                        data={summaryData}
                        loading={loadingSummary}
                    />
                </Paper>
            )}

            {/* Regularization Submission Modal */}
            <Dialog open={isRegModalOpen} onClose={handleCloseRegModal} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 600, color: '#333' }}>Request Attendance Regularization</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                        Provide details below to submit a regularization request for shortage worked hours on <strong>{selectedRecord ? dayjs(selectedRecord.date).format('MMM DD, YYYY') : ''}</strong>.
                    </Typography>
                    <TextField
                        label="Reason for Regularization"
                        fullWidth
                        required
                        variant="outlined"
                        sx={{ mb: 3 }}
                        value={regReason}
                        onChange={(e) => setRegReason(e.target.value)}
                        placeholder="e.g. On-duty cluster migration deployment, punch-in missed"
                    />
                    <TextField
                        label="Remarks / Context"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={regRemarks}
                        onChange={(e) => setRegRemarks(e.target.value)}
                        placeholder="Optional remarks or detailed description"
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button variant="outlined" color="primary" onClick={handleCloseRegModal} disabled={submittingReg}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="secondary" onClick={handleSubmitRegularization} loading={submittingReg}>
                        Submit Request
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Attendance Modal */}
            <Dialog open={isEditModalOpen} onClose={handleCloseEditModal} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 600, color: '#333' }}>Edit Attendance Log ({editingRecord?.username})</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Typography variant="body2" color="textSecondary">
                        Directly modify login/logout times, worked hours, and status for this record.
                    </Typography>
                    <TextField
                        label="Date"
                        type="date"
                        fullWidth
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField
                                label="First Login"
                                type="time"
                                fullWidth
                                value={editLogin}
                                onChange={(e) => setEditLogin(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Last Logout"
                                type="time"
                                fullWidth
                                value={editLogout}
                                onChange={(e) => setEditLogout(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>
                    <TextField
                        label="Worked Hours override (Calculated if empty)"
                        type="number"
                        fullWidth
                        value={editHours}
                        onChange={(e) => setEditHours(parseFloat(e.target.value) || 0)}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Regularization Status</InputLabel>
                        <Select
                            value={editStatus}
                            label="Regularization Status"
                            onChange={(e) => setEditStatus(e.target.value)}
                        >
                            <MenuItem value="None">None</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Approved">Approved</MenuItem>
                            <MenuItem value="Rejected">Rejected</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button variant="outlined" color="primary" onClick={handleCloseEditModal} disabled={submittingEdit}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="secondary" onClick={handleSaveEdit} loading={submittingEdit}>
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Detailed Attendance Calendar Modal */}
            <Dialog 
                open={isCalModalOpen} 
                onClose={handleCloseCalendar} 
                maxWidth="lg" 
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                        minHeight: '80vh'
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: '#333', pb: 1 }}>
                    Attendance Calendar — {calEmployee?.fullName || calEmployee?.username}
                </DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
                        Tracked for period: <strong>{selectedPeriod}</strong>. Late days are marked dynamically based on Policy Grace Period configurations.
                    </Typography>

                    {loadingCal ? (
                        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                            <LinearProgress sx={{ width: '50%', maxWidth: 300, height: 6, borderRadius: 3 }} />
                            <Typography variant="body2" color="textSecondary">Loading employee calendar records...</Typography>
                        </Box>
                    ) : (
                        <Box>
                            {/* Calendar Grid Container */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => (
                                    <Grid item xs={12/7} key={dayName} sx={{ display: { xs: 'none', md: 'block' } }}>
                                        <Paper sx={{ py: 1.5, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 2, boxShadow: 'none' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#555' }}>
                                                {dayName}
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>

                            <Box 
                                sx={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', md: 'repeat(7, 1fr)' }, 
                                    gap: 2 
                                }}
                            >
                                {/* Start placeholders to align correct day-of-week */}
                                {(() => {
                                    const period = periods.find(p => p.label === selectedPeriod);
                                    if (!period) return null;
                                    const startDayOfWeek = dayjs(period.startDate).day();
                                    return Array.from({ length: startDayOfWeek }).map((_, idx) => (
                                        <Box key={`placeholder-${idx}`} sx={{ display: { xs: 'none', md: 'block' }, minHeight: 120 }} />
                                    ));
                                })()}

                                {/* Actual dates grid */}
                                {(() => {
                                    const period = periods.find(p => p.label === selectedPeriod);
                                    if (!period) return null;
                                    const days = [];
                                    let current = dayjs(period.startDate);
                                    const last = dayjs(period.endDate);
                                    while (current.isBefore(last) || current.isSame(last, 'day')) {
                                        days.push(current);
                                        current = current.add(1, 'day');
                                    }

                                    const grace = cycleConfig.lateGracePeriod || 30;

                                    return days.map((day) => {
                                        const dateStr = day.format('YYYY-MM-DD');
                                        const log = calLogs.find(l => l.date === dateStr);
                                        
                                        // Match roster for this employee and date
                                        const dayRoster = calRosters.find(r => r.date === dateStr && r.assignees?.includes(calEmployee?.username));
                                        
                                        let status: 'Present' | 'Late' | 'Absent' = 'Absent';
                                        let inTime = '-';
                                        let outTime = '-';
                                        let shiftName = 'Default';
                                        let shiftStartStr = cycleConfig.shiftStart || '09:00';

                                        if (dayRoster) {
                                            shiftName = dayRoster.shift;
                                            const shiftInfo = (cycleConfig as any).shifts?.find((s: any) => s.name === dayRoster.shift);
                                            if (shiftInfo) {
                                                shiftStartStr = shiftInfo.startTime || '09:00';
                                            }
                                        }

                                        if (log) {
                                            inTime = log.firstLogin ? dayjs(log.firstLogin).format('hh:mm A') : '-';
                                            outTime = log.lastLogout ? dayjs(log.lastLogout).format('hh:mm A') : '-';

                                            if (log.firstLogin) {
                                                const loginTime = dayjs(log.firstLogin);
                                                const [sh, sm] = shiftStartStr.split(':').map(Number);
                                                const threshold = loginTime.hour(sh).minute(sm).add(grace, 'minute');
                                                if (loginTime.isAfter(threshold)) {
                                                    status = 'Late';
                                                } else {
                                                    status = 'Present';
                                                }
                                            } else {
                                                status = 'Present';
                                            }
                                        }

                                        const isWeekend = day.day() === 0 || day.day() === 6;

                                        let bgColor = 'rgba(0, 0, 0, 0.02)';
                                        let borderColor = 'rgba(0, 0, 0, 0.08)';
                                        let textColor = '#777';
                                        let statusLabel = isWeekend ? 'Weekend' : 'Absent';
                                        let labelColor = '#9e9e9e';

                                        if (status === 'Present') {
                                            bgColor = 'rgba(46, 125, 50, 0.04)';
                                            borderColor = 'rgba(46, 125, 50, 0.2)';
                                            textColor = '#2e7d32';
                                            statusLabel = 'Present';
                                            labelColor = '#2e7d32';
                                        } else if (status === 'Late') {
                                            bgColor = 'rgba(239, 83, 80, 0.04)';
                                            borderColor = 'rgba(239, 83, 80, 0.2)';
                                            textColor = '#c62828';
                                            statusLabel = 'Late Entry';
                                            labelColor = '#e65100';
                                        }

                                        return (
                                            <Paper
                                                key={dateStr}
                                                sx={{
                                                    p: 2,
                                                    minHeight: 120,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    borderRadius: 2,
                                                    backgroundColor: bgColor,
                                                    border: '1px solid',
                                                    borderColor: borderColor,
                                                    boxShadow: 'none',
                                                    transition: 'all 0.2s',
                                                    '&:hover': {
                                                        transform: 'translateY(-2px)',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                                    }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <Box>
                                                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.5, color: '#333' }}>
                                                            {day.format('DD')}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>
                                                            {day.format('MMM')}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                                        <Chip
                                                            label={statusLabel}
                                                            size="small"
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '9px',
                                                                fontWeight: 700,
                                                                backgroundColor: 'rgba(0,0,0,0.04)',
                                                                color: labelColor,
                                                                border: 'none'
                                                            }}
                                                        />
                                                        {dayRoster && (
                                                            <Chip
                                                                label={shiftName}
                                                                size="small"
                                                                sx={{
                                                                    height: 18,
                                                                    fontSize: '8px',
                                                                    fontWeight: 600,
                                                                    backgroundColor: 'rgba(63, 81, 181, 0.08)',
                                                                    color: '#3f51b5',
                                                                    border: 'none'
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                </Box>

                                                <Box sx={{ mt: 1.5 }}>
                                                    {status !== 'Absent' ? (
                                                        <Box>
                                                            <Typography variant="caption" display="block" sx={{ color: '#555', fontWeight: 500 }}>
                                                                <strong>In:</strong> {inTime}
                                                            </Typography>
                                                            <Typography variant="caption" display="block" sx={{ color: '#555', fontWeight: 500, mt: 0.2 }}>
                                                                <strong>Out:</strong> {outTime}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                                                            No Punch Log
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Paper>
                                        );
                                    });
                                })()}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button variant="contained" color="primary" onClick={handleCloseCalendar}>
                        Close Calendar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Attendance;