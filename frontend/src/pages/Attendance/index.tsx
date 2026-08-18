// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, MenuItem, Select, FormControl, InputLabel, Grid, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Chip, LinearProgress, Tabs, Tab, Divider } from '@mui/material';
import TextField from '../../components/TextField';
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
import { getServerTime } from '../../helpers/time';
import styles from './index.module.scss';
import VerificationModal from './VerificationModal';

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
    shiftName?: string;
    shiftStart?: string;
    shiftEnd?: string;
    lateApprovalStatus?: string | null;
    isLateAttempt?: boolean;
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
    const [savedLogs, setSavedLogs] = useState<AttendanceRecord[]>([]);
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
    const [departments, setDepartments] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [employeeFilter, setEmployeeFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

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

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);

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

    // Verification Modal State
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [selectedVerificationPeriod, setSelectedVerificationPeriod] = useState<PeriodOption | null>(null);
    const [verifiedPeriods, setVerifiedPeriods] = useState<string[]>([]);

    // Current Logged In User Info
    const { username, isSuperuser, department: userDept } = useSelector((state: RootState) => state.auth);
    const privileges = useSelector((state: RootState) => state.auth.privileges || []);
    const canViewDepartmental = hasPrivilege(PRIVILEGES.VIEW_DEPARTMENTAL_ATTENDACE, privileges) || isSuperuser;
    const canViewAll = hasPrivilege(PRIVILEGES.VIEW_ALL_ATTENDACE, privileges) || isSuperuser;
    const canEdit = hasPrivilege(PRIVILEGES.ATTENDANCE_UPDATE, privileges) || isSuperuser;
    const canDelete = hasPrivilege(PRIVILEGES.ATTENDANCE_DELETE, privileges) || isSuperuser;
    const canViewVerification = hasPrivilege(PRIVILEGES.VIEW_ATTENDANCE_VERIFICATION, privileges) || isSuperuser || hasPrivilege(PRIVILEGES.ATTENDANCE_VERIFY, privileges);
    const canVerify = hasPrivilege(PRIVILEGES.ATTENDANCE_VERIFY, privileges) || isSuperuser;
    
    const canViewOthers = canViewAll || canViewDepartmental;
    const filteredEmployees = employees.filter(emp => {
        if (canViewAll) {
            if (departmentFilter) {
                return emp.department === departmentFilter || (departments.find(d => d.id === departmentFilter)?.name === emp.department);
            }
            return true;
        }
        return emp.department === userDept || (departments.find(d => d.id === userDept)?.name === emp.department);
    });

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // 1. Fetch Cycle Configuration & Build Dynamic Periods
    const loadCycleConfig = useCallback(async () => {
        try {
            const timeRes = await request.get('/api/attendance/server-time');
            const serverNow = timeRes.data.currentTime ? dayjs(timeRes.data.currentTime) : getServerTime();

            const res = await request.get('/api/attendance/config');
            const config = res.data || { startDay: 1, endDay: 31 };
            setCycleConfig(config);

            const options: PeriodOption[] = [];
            const startDay = config.startDay;
            const endDay = config.endDay;

            // Generate monthly cycles starting from app start date (May 2026) up to current active cycle
            const appStart = dayjs('2026-05-01');
            const today = serverNow;
            let tempDate = appStart.startOf('month');

            while (true) {
                let startMoment, endMoment;

                if (startDay === 1) {
                    startMoment = tempDate.startOf('month');
                    endMoment = tempDate.endOf('month');
                } else {
                    // E.g., if startDay = 21, cycle starts 21st of prev month to 20th of current month
                    startMoment = tempDate.subtract(1, 'month').date(startDay);
                    endMoment = tempDate.date(endDay);
                }

                // Stop generating if the cycle starts in the future
                if (startMoment.isAfter(today)) {
                    break;
                }

                options.push({
                    label: `${startMoment.format('MMM DD, YYYY')} - ${endMoment.format('MMM DD, YYYY')}`,
                    startDate: startMoment.format('YYYY-MM-DD'),
                    endDate: endMoment.format('YYYY-MM-DD')
                });

                tempDate = tempDate.add(1, 'month');
            }

            // Sort periods so the most recent periods appear first (index 0 is newest)
            options.reverse();

            setPeriods(options);

            // Find current active period and select it by default
            const todayStr = serverNow.format('YYYY-MM-DD');
            const currentPeriod = options.find(p => todayStr >= p.startDate && todayStr <= p.endDate);
            if (currentPeriod) {
                setSelectedPeriod(currentPeriod.label);
            } else if (options.length > 0) {
                setSelectedPeriod(options[0].label); // default fallback to the most recent period
            }

            // Fetch verification statuses
            try {
                const verRes = await request.get('/api/attendance/verification-status');
                setVerifiedPeriods(verRes.data?.verifiedPeriods || []);
            } catch(e) {}
        } catch (e: any) {
            console.error("CYCLE CONFIG ERROR:", e);
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
                setDepartments(res.data.data.map((d: any) => ({ id: d.id || d._id, name: d.name })));
            }
        } catch (e) {
            // Silently fail or ignore if not allowed
        }
    }, []);

    // Fetch Employees List (for Filter Dropdown)
    const loadEmployees = useCallback(async () => {
        try {
            const res = await request.get('/api/users/', {
                params: { pagination: false }
            });
            if (res.data && res.data.data) {
                setEmployees(res.data.data);
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

            if (canViewAll && departmentFilter) {
                params.department = departmentFilter;
            }

            if (employeeFilter) {
                params.username = employeeFilter;
            }

            const response = await request.get('/api/attendance/', {
                params
            });

            setData(response.data.data);
            setSavedLogs(response.data.data);
            setTotalCount(response.data.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to fetch attendance logs', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, selectedPeriod, departmentFilter, employeeFilter, periods, canViewAll, showToast]);

    const isRecordLate = (row: AttendanceRecord) => {
        if (!row.firstLogin) return false;
        const loginTime = dayjs(row.firstLogin);
        const shiftStartTime = row.shiftStart || '09:00';
        const [sh, sm] = shiftStartTime.split(':').map(Number);
        const configGrace = cycleConfig?.lateGracePeriod || 30;
        const threshold = loginTime.clone().hour(sh).minute(sm).second(0).millisecond(0).add(configGrace, 'minute');
        return loginTime.isAfter(threshold);
    };

    const getRealtimeSummary = () => {
        const adjustments = new Map<string, { presentDiff: number; lateDiff: number }>();

        savedLogs.forEach((orig) => {
            const current = data.find((d) => d.id === orig.id);
            if (!current) {
                const username = orig.username;
                const adj = adjustments.get(username) || { presentDiff: 0, lateDiff: 0 };
                adj.presentDiff -= 1;
                const wasLate = isRecordLate(orig) && orig.regularizeStatus !== 'Approved';
                if (wasLate) {
                    adj.lateDiff -= 1;
                }
                adjustments.set(username, adj);
            }
        });

        data.forEach((current) => {
            const orig = savedLogs.find((d) => d.id === current.id);
            const username = current.username;
            const adj = adjustments.get(username) || { presentDiff: 0, lateDiff: 0 };

            if (!orig) {
                adj.presentDiff += 1;
                const isLateNow = isRecordLate(current) && current.regularizeStatus !== 'Approved';
                if (isLateNow) {
                    adj.lateDiff += 1;
                }
            } else {
                const wasLate = isRecordLate(orig) && orig.regularizeStatus !== 'Approved';
                const isLateNow = isRecordLate(current) && current.regularizeStatus !== 'Approved';
                if (wasLate && !isLateNow) {
                    adj.lateDiff -= 1;
                } else if (!wasLate && isLateNow) {
                    adj.lateDiff += 1;
                }
            }
            adjustments.set(username, adj);
        });

        return summaryData.map((item) => {
            const adj = adjustments.get(item.username) || { presentDiff: 0, lateDiff: 0 };
            return {
                ...item,
                presentDays: Math.max(0, item.presentDays + adj.presentDiff),
                lateDays: Math.max(0, item.lateDays + adj.lateDiff)
            };
        });
    };

    const loadSummary = useCallback(async () => {
        setLoadingSummary(true);
        try {
            const period = periods.find(p => p.label === selectedPeriod);
            const params: any = {};
            if (period) {
                params.startDate = period.startDate;
                params.endDate = period.endDate;
            }
            if (canViewAll && departmentFilter) {
                params.department = departmentFilter;
            }
            if (employeeFilter) {
                params.username = employeeFilter;
            }
            const res = await request.get('/api/attendance/summary', { params });
            setSummaryData(res.data || []);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to fetch attendance summary', 'error');
        } finally {
            setLoadingSummary(false);
        }
    }, [selectedPeriod, departmentFilter, employeeFilter, periods, canViewAll, showToast]);

    useEffect(() => {
        loadCycleConfig();
        loadDepartments();
        loadEmployees();
    }, [loadCycleConfig, loadDepartments, loadEmployees]);

    useEffect(() => {
        setPage(0);
        setEmployeeFilter('');
    }, [searchQuery, departmentFilter]);

    useEffect(() => {
        if (periods.length > 0 && selectedPeriod) {
            loadAttendance();
            loadSummary();
        }
    }, [periods, selectedPeriod, page, rowsPerPage, searchQuery, departmentFilter, employeeFilter, loadAttendance, loadSummary]);

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
            setData(prev => prev.map(item => item.id === selectedRecord?.id ? { ...item, regularizeStatus: 'Pending', regularizeReason: regReason, regularizeRemarks: regRemarks } : item));
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
            setData(prev => prev.map(item => item.id === row.id ? { ...item, regularizeStatus: 'Approved' } : item));
            try {
                await request.post(`/api/attendance/approve/${row.id}`);
                showToast('Regularization request approved', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                loadAttendance();
                showToast(e?.response?.data?.detail || 'Failed to approve regularization', 'error');
            }
        }
    };

    const handleReject = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to reject regularization for ${row.username} on ${row.date}?`, 'Reject Regularization');
        if (isConfirmed) {
            setData(prev => prev.map(item => item.id === row.id ? { ...item, regularizeStatus: 'Rejected' } : item));
            try {
                await request.post(`/api/attendance/reject/${row.id}`, {
                    remarks: "Rejected by Department Head"
                });
                showToast('Regularization request rejected', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                loadAttendance();
                showToast(e?.response?.data?.detail || 'Failed to reject regularization', 'error');
            }
        }
    };

    const handleApproveLate = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to allow late login for ${row.username} on ${row.date}?`, 'Approve Late Login');
        if (isConfirmed) {
            setData(prev => prev.map(item => item.id === row.id ? { ...item, lateApprovalStatus: 'Approved' } : item));
            try {
                await request.post(`/api/attendance/approve-late/${row.id}`);
                showToast('Late login approved successfully', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                loadAttendance();
                showToast(e?.response?.data?.detail || 'Failed to approve late login', 'error');
            }
        }
    };

    const handleRejectLate = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to reject late login for ${row.username} on ${row.date}?`, 'Reject Late Login');
        if (isConfirmed) {
            setData(prev => prev.map(item => item.id === row.id ? { ...item, lateApprovalStatus: 'Rejected' } : item));
            try {
                await request.post(`/api/attendance/reject-late/${row.id}`, {
                    remarks: "Late login rejected by Department Head"
                });
                showToast('Late login rejected', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                loadAttendance();
                showToast(e?.response?.data?.detail || 'Failed to reject late login', 'error');
            }
        }
    };

    const handleDelete = async (row: AttendanceRecord) => {
        const isConfirmed = await confirm(`Are you sure you want to delete attendance record for ${row.username} on ${row.date}?`, 'Delete Attendance Log');
        if (isConfirmed) {
            setData(prev => prev.filter(item => item.id !== row.id));
            try {
                await request.delete(`/api/attendance/${row.id}`);
                showToast('Attendance log deleted successfully', 'success');
                loadAttendance();
                loadSummary();
            } catch (e: any) {
                loadAttendance();
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
            const workedHrs = parseFloat(editHours.toString()) || 0.0;
            setData(prev => prev.map(item => item.id === editingRecord.id ? {
                ...item,
                firstLogin: firstLoginIso,
                lastLogout: lastLogoutIso,
                workedHours: workedHrs,
                regularizeStatus: editStatus
            } : item));

            await request.put(`/api/attendance/${editingRecord.id}`, {
                firstLogin: firstLoginIso,
                lastLogout: lastLogoutIso,
                workedHours: workedHrs,
                regularizeStatus: editStatus
            });

            showToast('Attendance record updated successfully', 'success');
            handleCloseEditModal();
            loadAttendance();
            loadSummary();
        } catch (e: any) {
            loadAttendance();
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

    const handleOpenVerificationModal = (period: PeriodOption) => {
        setSelectedVerificationPeriod(period);
        setIsVerificationModalOpen(true);
    };

    const handleCloseVerificationModal = () => {
        setIsVerificationModalOpen(false);
        setSelectedVerificationPeriod(null);
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
        {
            id: 'department',
            label: 'Department',
            sortable: true,
            render: (row) => {
                const d = departments.find(dept => dept.id === row.department);
                return d ? d.name : (row.department || '--');
            }
        },
        {
            id: 'shiftName',
            label: 'Shift',
            sortable: false,
            render: (row) => {
                const name = row.shiftName || 'Default';
                const start = row.shiftStart ? dayjs(`2000-01-01T${row.shiftStart}`).format('hh:mm A') : '09:00 AM';
                const end = row.shiftEnd ? dayjs(`2000-01-01T${row.shiftEnd}`).format('hh:mm A') : '05:00 PM';
                return (
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {start} - {end}
                        </Typography>
                    </Box>
                );
            }
        },
        {
            id: 'firstLogin',
            label: 'First Login',
            sortable: false,
            render: (row) => {
                if (!row.firstLogin) return '-';
                const timeStr = dayjs(row.firstLogin).format('hh:mm A');

                // If this is a late attempt, show approval status chip
                if (row.isLateAttempt) {
                    const lateStatus = row.lateApprovalStatus || 'Pending';
                    let label = 'Late Login (Pending)';
                    let chipColor = '#e65100';
                    let chipBg = '#fff3e0';

                    if (lateStatus === 'Approved') {
                        label = 'Late Login (Approved)';
                        chipColor = '#2e7d32';
                        chipBg = '#e8f5e9';
                    } else if (lateStatus === 'Rejected') {
                        label = 'Late Login (Rejected)';
                        chipColor = '#c62828';
                        chipBg = '#ffebee';
                    }

                    return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ color: '#c62828', fontWeight: 600, fontSize: '0.875rem' }}>
                                {timeStr}
                            </Typography>
                            <Chip
                                label={label}
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '10px',
                                    backgroundColor: chipBg,
                                    color: chipColor,
                                    fontWeight: 600,
                                    alignSelf: 'flex-start'
                                }}
                            />
                        </Box>
                    );
                }

                // Determine if late using dynamic shift start timing
                const loginTime = dayjs(row.firstLogin);
                const shiftStartTime = row.shiftStart || cycleConfig.shiftStart || '09:00';
                const [sh, sm] = shiftStartTime.split(':').map(Number);
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
            render: (row) => {
                if (!row.lastLogout) return '-';
                const timeStr = dayjs(row.lastLogout).format('hh:mm A');

                const logoutTime = dayjs(row.lastLogout);
                const shiftEndTime = row.shiftEnd || '17:00';
                const [eh, em] = shiftEndTime.split(':').map(Number);
                const threshold = logoutTime.clone().hour(eh).minute(em).second(0).millisecond(0);
                const isEarly = logoutTime.isBefore(threshold);

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: isEarly ? '#e65100' : 'inherit', fontWeight: isEarly ? 600 : 'normal', fontSize: '0.875rem' }}>
                            {timeStr}
                        </Typography>
                        {isEarly && (
                            <Chip
                                label="Early Going"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '10px',
                                    backgroundColor: '#fff3e0',
                                    color: '#e65100',
                                    fontWeight: 600
                                }}
                            />
                        )}
                    </Box>
                );
            }
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
                        onClick={(e) => { e.stopPropagation(); handleOpenRegModal(row); }}
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
                const isLatePending = row.isLateAttempt && row.lateApprovalStatus === 'Pending';

                // Regularization can be approved by Department Head or Superuser
                // Department head handles requests from their department
                const canApprove = isSuperuser || (userDept === row.department);

                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {isLatePending && canApprove && (
                            <>
                                <Tooltip title="Approve Late Login">
                                    <IconButton size="small" color="success" sx={{ backgroundColor: 'rgba(46, 125, 50, 0.06)' }} onClick={(e) => { e.stopPropagation(); handleApproveLate(row); }}>
                                        <ApproveIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject Late Login">
                                    <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(198, 40, 40, 0.06)' }} onClick={(e) => { e.stopPropagation(); handleRejectLate(row); }}>
                                        <RejectIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        {canEdit && (
                            <Tooltip title="Edit Attendance Log">
                                <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.06)' }} onClick={(e) => { e.stopPropagation(); handleOpenEditModal(row); }}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {isPending && canApprove && (
                            <>
                                <Tooltip title="Approve Request">
                                    <IconButton size="small" color="success" sx={{ backgroundColor: 'rgba(46, 125, 50, 0.06)' }} onClick={(e) => { e.stopPropagation(); handleApprove(row); }}>
                                        <ApproveIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject Request">
                                    <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(198, 40, 40, 0.06)' }} onClick={(e) => { e.stopPropagation(); handleReject(row); }}>
                                        <RejectIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        {canDelete && (
                            <Tooltip title="Delete Attendance Log">
                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
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
        {
            id: 'department',
            label: 'Department',
            sortable: true,
            render: (row) => {
                const d = departments.find(dept => dept.id === row.department);
                return d ? d.name : (row.department || '--');
            }
        },
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
        <Box sx={{ p: 0 }}>
            <Box sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#333', mb: 0.5 }}>
                    Attendance Tracking
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    View timings, track active duration, and manage regularization requests.
                </Typography>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, nv) => setActiveTab(nv)}
                        textColor="primary"
                        indicatorColor="primary"
                        sx={{ mt: 2 }}
                    >
                        <Tab label="Logs" value={0} sx={{ fontWeight: 600 }} />
                        <Tab label="Summary" value={1} sx={{ fontWeight: 600 }} />
                        {canViewVerification && (
                            <Tab label="Verification" value={2} sx={{ fontWeight: 600 }} />
                        )}
                    </Tabs>
                </Box>
            </Box>

            {activeTab !== 2 && (
                <Paper sx={{ p: 3, mx: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <Box className={styles['attendance-filters']}>
                    <Box className={styles['attendance-filters__item']}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Calculation Period</InputLabel>

                            <Select
                                fullWidth
                                value={selectedPeriod}
                                label="Calculation Period"
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                            >
                                {periods.map((p, idx) => (
                                    <MenuItem key={idx} value={p.label}>
                                        {p.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    {canViewAll && (
                        <Box className={styles['attendance-filters__item']}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Department Filter</InputLabel>

                                <Select
                                    fullWidth
                                    value={departmentFilter}
                                    label="Department Filter"
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Departments</MenuItem>

                                    {departments.map((dept, idx) => (
                                        <MenuItem key={idx} value={dept.id}>
                                            {dept.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}

                    {canViewOthers && (
                        <Box className={styles['attendance-filters__item']}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Employee Filter</InputLabel>
                                <Select
                                    fullWidth
                                    value={employeeFilter}
                                    label="Employee Filter"
                                    onChange={(e) => setEmployeeFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Employees</MenuItem>
                                    {filteredEmployees.map((emp, idx) => (
                                        <MenuItem key={idx} value={emp.username}>
                                            {emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : emp.username}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}

                    <Box className={styles['attendance-filters__item']}>
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search employee..."
                            fullWidth
                        />
                    </Box>
                </Box>
            </Paper>
            )}

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
                        onRowClick={(row) => { setViewingRecord(row); setIsDetailOpen(true); }}
                    />
                </Paper>
            ) : activeTab === 1 ? (
                /* Employee Summary Table */
                <Paper sx={{ width: '100%', mb: 2, p: 0, mx: 3, boxShadow: 'none', background: 'transparent' }}>
                    <Table
                        columns={summaryColumns}
                        data={getRealtimeSummary()}
                        loading={loadingSummary}
                    />
                </Paper>
            ) : (
                /* Verification Tab */
                <Box sx={{ mx: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Attendance Verification Cycles</Typography>
                    <Grid container spacing={2}>
                        {periods.map((p, idx) => (
                            <Grid size={{xs: 12, sm: 6, md: 4}}     key={idx}>
                                <Paper 
                                    sx={{ p: 3, cursor: 'pointer', transition: '0.2s', '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' }, position: 'relative' }} 
                                    onClick={() => handleOpenVerificationModal(p)}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Attendance Report</Typography>
                                        {verifiedPeriods.includes(p.label) && (
                                            <Chip label="Verified" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                                        )}
                                    </Box>
                                    <Typography variant="body2" color="textSecondary">{p.label}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            <VerificationModal
                isOpen={isVerificationModalOpen}
                period={selectedVerificationPeriod}
                onClose={handleCloseVerificationModal}
                users={useSelector((state: RootState) => state.users.users).filter(u => (!canVerify && canViewVerification) ? u.department === userDept : true)}
                isVerified={selectedVerificationPeriod ? verifiedPeriods.includes(selectedVerificationPeriod.label) : false}
                onVerify={(label) => setVerifiedPeriods(prev => [...prev, label])}
                canVerify={canVerify}
            />

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
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <Grid container spacing={2}>
                        <Grid size={{xs: 6}}  >
                            <TextField
                                label="First Login"
                                type="time"
                                fullWidth
                                value={editLogin}
                                onChange={(e) => setEditLogin(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />
                        </Grid>
                        <Grid size={{xs: 6}}  >
                            <TextField
                                label="Last Logout"
                                type="time"
                                fullWidth
                                value={editLogout}
                                onChange={(e) => setEditLogout(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                slotProps={{ inputLabel: { shrink: true } }}
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
                slotProps={{ paper: { sx: {
                        borderRadius: 3,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                        minHeight: '80vh'
                    } } }}
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
                            {/* Day of Week Header Row */}
                            <Box
                                sx={{
                                    display: { xs: 'none', md: 'grid' },
                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                    gap: 2,
                                    mb: 1.5,
                                    textAlign: 'center'
                                }}
                            >
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                                    <Paper
                                        key={dayName}
                                        elevation={0}
                                        sx={{
                                            py: 1,
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            color: index === 0 || index === 6 ? '#d32f2f' : 'text.secondary',
                                            backgroundColor: 'rgba(0,0,0,0.03)',
                                            borderRadius: 1.5
                                        }}
                                    >
                                        {dayName}
                                    </Paper>
                                ))}
                            </Box>

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
                                        let isEarlyGoing = false;
                                        let inTime = '-';
                                        let outTime = '-';
                                        let shiftName = 'Default';
                                        let shiftStartStr = cycleConfig.shiftStart || '09:00';
                                        let shiftEndStr = '17:00';

                                        if (dayRoster) {
                                            // Resolve shift via roster row mapping
                                            const normStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                            const shiftCol = dayRoster.shift || '';
                                            const rosterAssignees: string[] = dayRoster.assignees || [];
                                            const userIdx = rosterAssignees.indexOf(calEmployee?.username || '');
                                            const cfgRosterRows: any[] = (cycleConfig as any).rosterRows || [];
                                            const cfgShifts: any[] = (cycleConfig as any).shifts || [];
                                            let mappedShift = shiftCol;

                                            if (userIdx >= 0 && cfgRosterRows.length > 0) {
                                                const colRows = cfgRosterRows
                                                    .filter((r: any) => normStr(r.name).includes(normStr(shiftCol)))
                                                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                                                if (userIdx < colRows.length) {
                                                    mappedShift = colRows[userIdx].mappedShift || shiftCol;
                                                }
                                            }

                                            const resolvedShiftInfo = cfgShifts.find((s: any) => normStr(s.name) === normStr(mappedShift));
                                            shiftName = resolvedShiftInfo?.name || mappedShift;
                                            shiftStartStr = resolvedShiftInfo?.startTime || shiftStartStr;
                                            shiftEndStr = resolvedShiftInfo?.endTime || shiftEndStr;
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

                                            if (log.lastLogout) {
                                                const logoutTime = dayjs(log.lastLogout);
                                                const [eh, em] = shiftEndStr.split(':').map(Number);
                                                const threshold = logoutTime.clone().hour(eh).minute(em).second(0).millisecond(0);
                                                if (logoutTime.isBefore(threshold)) {
                                                    isEarlyGoing = true;
                                                }
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
                                            statusLabel = isEarlyGoing ? 'Early Going' : 'Present';
                                            labelColor = isEarlyGoing ? '#e65100' : '#2e7d32';
                                        } else if (status === 'Late') {
                                            bgColor = 'rgba(239, 83, 80, 0.04)';
                                            borderColor = 'rgba(239, 83, 80, 0.2)';
                                            textColor = '#c62828';
                                            statusLabel = isEarlyGoing ? 'Late & Early' : 'Late Entry';
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
                                                        <Typography variant="caption" sx={{ color: '#888', fontWeight: 600, display: 'block' }}>
                                                            {day.format('MMM')}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#555', fontWeight: 700, display: 'block', mt: 0.2 }}>
                                                            {day.format('dddd')}
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
                                                                backgroundColor: isEarlyGoing ? '#fff3e0' : 'rgba(0,0,0,0.04)',
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
                                                            <Typography variant="caption"  sx={{ display: 'block',  color: '#555', fontWeight: 500 }}>
                                                                <strong>In:</strong> {inTime}
                                                            </Typography>
                                                            <Typography variant="caption"  sx={{ display: 'block',  color: '#555', fontWeight: 500, mt: 0.2 }}>
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

            {/* Detailed Attendance Row Modal */}
            <Dialog
                open={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                maxWidth="sm"
                fullWidth
                slotProps={{ paper: { sx: {
                        borderRadius: 3,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    } } }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: '#333', pb: 1 }}>
                    Attendance & Regularization Details
                </DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    {viewingRecord && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Employee Name</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#333' }}>
                                        {viewingRecord.fullName || viewingRecord.username}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Department</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#333' }}>
                                        {departments.find(d => d.id === viewingRecord.department)?.name || viewingRecord.department || '--'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Date</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {dayjs(viewingRecord.date).format('MMMM DD, YYYY')} ({dayjs(viewingRecord.date).format('dddd')})
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Rostered Shift</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#3f51b5' }}>
                                        {(() => {
                                            const start = viewingRecord.shiftStart ? dayjs(`2000-01-01T${viewingRecord.shiftStart}`).format('hh:mm A') : '09:00 AM';
                                            const end = viewingRecord.shiftEnd ? dayjs(`2000-01-01T${viewingRecord.shiftEnd}`).format('hh:mm A') : '05:00 PM';
                                            return `${viewingRecord.shiftName || 'Default'} (${start} - ${end})`;
                                        })()}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>First Login</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                                        {viewingRecord.firstLogin ? dayjs(viewingRecord.firstLogin).format('hh:mm:ss A') : 'No punch-in'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Last Logout</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#c62828' }}>
                                        {viewingRecord.lastLogout ? dayjs(viewingRecord.lastLogout).format('hh:mm:ss A') : 'No punch-out'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Worked Hours</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 700, color: viewingRecord.workedHours < 8 ? '#d32f2f' : '#2e7d32' }}>
                                        {viewingRecord.workedHours} hrs
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Lateness & Early Going Status</Typography>
                                    <Box sx={{ mt: 0.5, display: 'flex', gap: 1 }}>
                                        {(() => {
                                            const loginTime = viewingRecord.firstLogin ? dayjs(viewingRecord.firstLogin) : null;
                                            const shiftStartTime = viewingRecord.shiftStart || cycleConfig.shiftStart || '09:00';
                                            const [sh, sm] = shiftStartTime.split(':').map(Number);
                                            const grace = cycleConfig.lateGracePeriod || 30;
                                            const isLate = loginTime ? loginTime.isAfter(loginTime.clone().hour(sh).minute(sm).add(grace, 'minute')) : false;

                                            const logoutTime = viewingRecord.lastLogout ? dayjs(viewingRecord.lastLogout) : null;
                                            const shiftEndTime = viewingRecord.shiftEnd || '17:00';
                                            const [eh, em] = shiftEndTime.split(':').map(Number);
                                            const isEarly = logoutTime ? logoutTime.isBefore(logoutTime.clone().hour(eh).minute(em).second(0).millisecond(0)) : false;

                                            return (
                                                <>
                                                    {isLate ? (
                                                        <Chip label="Late Entry" size="small" sx={{ backgroundColor: '#ffebee', color: '#c62828', fontWeight: 600 }} />
                                                    ) : (
                                                        <Chip label="On Time" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} />
                                                    )}
                                                    {isEarly && (
                                                        <Chip label="Early Going" size="small" sx={{ backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 600 }} />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </Box>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#e65100', mb: 0.5 }}>
                                Regularization Request Details
                            </Typography>

                            {viewingRecord.regularizeStatus ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderRadius: 2, backgroundColor: '#fdfbf7', border: '1px solid #f5ebd3' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Request Status:</Typography>
                                        <Chip
                                            label={viewingRecord.regularizeStatus}
                                            size="small"
                                            sx={{
                                                fontWeight: 700,
                                                backgroundColor:
                                                    viewingRecord.regularizeStatus === 'Approved' ? '#e8f5e9' :
                                                        viewingRecord.regularizeStatus === 'Rejected' ? '#ffebee' : '#fff3e0',
                                                color:
                                                    viewingRecord.regularizeStatus === 'Approved' ? '#2e7d32' :
                                                        viewingRecord.regularizeStatus === 'Rejected' ? '#c62828' : '#e65100'
                                            }}
                                        />
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block' }}>
                                            Reason for Regularization
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#555', mt: 0.5, fontStyle: 'italic' }}>
                                            "{viewingRecord.regularizeReason || 'No reason provided'}"
                                        </Typography>
                                    </Box>
                                    {viewingRecord.regularizeRemarks && (
                                        <Box>
                                            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, display: 'block' }}>
                                                Approver Remarks
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#555', mt: 0.5 }}>
                                                {viewingRecord.regularizeRemarks}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#f5f5f5', border: '1px dashed #ccc', textAlign: 'center' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        No regularization request submitted for this day.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button variant="contained" color="primary" onClick={() => setIsDetailOpen(false)}>
                        Close Details
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Attendance;