// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Paper, CircularProgress,
    Chip, Alert
} from '@mui/material';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import request from '../../services/request';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import { MdUpload as UploadIcon } from 'react-icons/md';
import type { UserData } from '../Users/model';

interface VerificationModalProps {
    isOpen: boolean;
    period: { label: string; startDate: string; endDate: string; } | null;
    onClose: () => void;
    users: UserData[];
    isVerified: boolean;
    onVerify: (label: string) => void;
    canVerify: boolean;
}

interface CombinedRecord {
    id: string; // unique key
    username: string;
    passNumber: string | null;
    fullName: string;
    date: string;

    appFirstLogin: string | null;
    appLastLogout: string | null;
    appWorkedHours: number;

    csvFirstIn: string | null;
    csvLastOut: string | null;

    isValid: boolean;
    errorReasons: string[];
}

const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, period, onClose, users, isVerified, onVerify, canVerify }) => {
    const { showToast } = useToast();
    const [loadingAppRecords, setLoadingAppRecords] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [appRecords, setAppRecords] = useState<any[]>([]);
    const [csvRecords, setCsvRecords] = useState<any[]>([]);
    const [combinedData, setCombinedData] = useState<CombinedRecord[]>([]);
    const [isLoadedVerified, setIsLoadedVerified] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch app attendance logs for the period when modal opens
    useEffect(() => {
        if (isOpen && period) {
            setCsvRecords([]);
            setIsLoadedVerified(false);
            if (isVerified) {
                fetchVerifiedData();
            } else {
                fetchAppRecords();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, period, isVerified]);

    const fetchVerifiedData = async () => {
        if (!period) return;
        setLoadingAppRecords(true);
        try {
            const res = await request.get('/api/attendance/verification-data', {
                params: { periodLabel: period.label }
            });
            const filteredData = (res.data.data || []).filter((rec: any) => {
                return !period || (rec.date >= period.startDate && rec.date <= period.endDate);
            });
            setCombinedData(filteredData);
            setIsLoadedVerified(true);
        } catch (err: any) {
            showToast('Failed to load verified data', 'error');
        } finally {
            setLoadingAppRecords(false);
        }
    };

    const fetchAppRecords = async () => {
        if (!period) return;
        setLoadingAppRecords(true);
        try {
            const res = await request.get('/api/attendance/', {
                params: {
                    startDate: period.startDate,
                    endDate: period.endDate,
                    pagination: false
                }
            });
            setAppRecords(res.data.data || []);
        } catch (err: any) {
            showToast('Failed to load app attendance records', 'error');
        } finally {
            setLoadingAppRecords(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            transform: (value) => typeof value === 'string' ? value.trim() : value,
            complete: (results) => {
                const data = results.data as any[];
                setCsvRecords(data);
                showToast(`Loaded ${data.length} records from CSV`, 'success');
            },
            error: (error) => {
                showToast(`Failed to parse CSV: ${error.message}`, 'error');
            }
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleVerify = async () => {
        if (!period) return;
        setIsVerifying(true);
        try {
            await request.post('/api/attendance/verify-period', { periodLabel: period.label, data: combinedData });
            showToast('Attendance period verified successfully!', 'success');
            onVerify(period.label);
        } catch (err: any) {
            showToast('Failed to verify period', 'error');
        } finally {
            setIsVerifying(false);
        }
    };

    // Build the combined data whenever appRecords or csvRecords change
    useEffect(() => {
        if (!isOpen || isLoadedVerified) return;

        // Map users by enrollmentId (passNumber) and username
        const passMap = new Map<string, UserData>();
        const usernameMap = new Map<string, UserData>();

        users.forEach(u => {
            usernameMap.set(u.username, u);
            if (u.passNumber) {
                passMap.set(u.passNumber.replace(/\s+/g, ''), u);
            }
        });

        const mergedMap = new Map<string, CombinedRecord>();

        const getOrCreateRecord = (username: string, date: string): CombinedRecord => {
            const key = `${username}_${date}`;
            if (!mergedMap.has(key)) {
                const u = usernameMap.get(username);
                mergedMap.set(key, {
                    id: key,
                    username,
                    passNumber: u ? u.passNumber || null : null,
                    fullName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : username,
                    date,
                    appFirstLogin: null,
                    appLastLogout: null,
                    appWorkedHours: 0,
                    csvFirstIn: null,
                    csvLastOut: null,
                    isValid: true,
                    errorReasons: []
                });
            }
            return mergedMap.get(key)!;
        };

        // 1. Add app records
        appRecords.forEach(appRecord => {
            const date = appRecord.date;
            if (period && (date < period.startDate || date > period.endDate)) return;
            const username = appRecord.username;
            const rec = getOrCreateRecord(username, date);
            rec.appFirstLogin = appRecord.firstLogin;
            rec.appLastLogout = appRecord.lastLogout;
            rec.appWorkedHours = appRecord.workedHours || 0;
        });

        // 2. Add CSV records
        // CSV columns: enrollment, entrydate, firstIn, lastOut
        csvRecords.forEach(csvRow => {
            const getCol = (key: string) => {
                const k = Object.keys(csvRow).find(k => k.trim().toLowerCase() === key.toLowerCase() || k.trim().toLowerCase() === key.toLowerCase().replace(' ', ''));
                return k ? csvRow[k] : undefined;
            };

            const passNum = (getCol('enrollment') || getCol('enrollmentId'))?.toString().replace(/\s+/g, '');
            if (!passNum) return;

            const user = passMap.get(passNum);
            if (!user) return; // Skip if user not found for this passNumber

            // Parse entrydate. Could be multiple formats, assume robust parsing or simple 'YYYY-MM-DD' or 'DD/MM/YYYY'
            let dateStr = getCol('entrydate')?.trim();
            if (!dateStr) return;

            // Normalize date format to YYYY-MM-DD
            let dateObj = dayjs(dateStr);
            if (!dateObj.isValid()) {
                // Try DD-MM-YYYY or DD/MM/YYYY
                const parts = dateStr.split(/[-/]/);
                if (parts.length === 3) {
                    // assume DD-MM-YYYY
                    dateObj = dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
            }
            if (!dateObj.isValid()) return;

            const normalizedDate = dateObj.format('YYYY-MM-DD');
            if (period && (normalizedDate < period.startDate || normalizedDate > period.endDate)) return;
            const rec = getOrCreateRecord(user.username, normalizedDate);

            // Format firstIn and lastOut to extract just the time if it contains the date
            // The CSV contains values like "21-05-2026 08:34"
            const extractTime = (val: string | undefined | null) => {
                if (!val) return null;
                val = val.trim();
                const parts = val.split(' ');
                if (parts.length > 1) {
                    return parts[parts.length - 1]; // Return the time part
                }
                return val;
            };

            rec.csvFirstIn = extractTime(getCol('firstIn') || getCol('first in'));
            rec.csvLastOut = extractTime(getCol('lastOut') || getCol('last out'));
        });

        // 3. Validation Logic
        const finalData = Array.from(mergedMap.values()).map(rec => {
            const errors: string[] = [];
            let valid = true;

            if (rec.appWorkedHours < 8) {
                valid = false;
                errors.push('Worked less than 8 hours');
            }

            // Compare timings
            if (rec.appFirstLogin && rec.csvFirstIn) {
                const appIn = dayjs(rec.appFirstLogin);
                // CSV firstIn is usually HH:mm or similar, let's construct a full datetime
                const csvIn = dayjs(`${rec.date} ${rec.csvFirstIn}`);
                if (csvIn.isValid() && appIn.isBefore(csvIn)) {
                    valid = false;
                    errors.push('App login is earlier than CSV login');
                }
            } else if (rec.appFirstLogin && !rec.csvFirstIn) {
                // Have app login but no CSV login
                valid = false;
                errors.push('App login exists but no CSV login');
            }

            if (rec.appLastLogout && rec.csvLastOut) {
                const appOut = dayjs(rec.appLastLogout);
                const csvOut = dayjs(`${rec.date} ${rec.csvLastOut}`);
                if (csvOut.isValid() && appOut.isAfter(csvOut)) {
                    valid = false;
                    errors.push('App logout is later than CSV logout');
                }
            } else if (rec.appLastLogout && !rec.csvLastOut) {
                valid = false;
                errors.push('App logout exists but no CSV logout');
            }

            rec.isValid = valid;
            rec.errorReasons = errors;
            return rec;
        });

        // Sort by date desc, then by name
        finalData.sort((a, b) => {
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            return a.fullName.localeCompare(b.fullName);
        });

        setCombinedData(finalData);

    }, [appRecords, csvRecords, users, isOpen, isLoadedVerified]);

    const formatTimeOnly = (isoString: string | null) => {
        if (!isoString) return '-';
        return dayjs(isoString).format('HH:mm');
    };

    const columns: Column<CombinedRecord>[] = [
        {
            id: 'date',
            label: 'Date',
            sortable: true,
            render: (row) => dayjs(row.date).format('MMM DD, YYYY')
        },
        {
            id: 'fullName',
            label: 'Employee Name',
            sortable: true,
            render: (row) => (
                <Box>
                    <Typography variant="body2">{row.fullName}</Typography>
                    {row.passNumber && (
                        <Typography variant="caption" color="textSecondary">
                            Pass: {row.passNumber.trim()}
                        </Typography>
                    )}
                </Box>
            )
        },
        {
            id: 'login',
            label: 'Login (CSV / App)',
            sortable: false,
            render: (row) => (
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>CSV: {row.csvFirstIn || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">App: {formatTimeOnly(row.appFirstLogin)}</Typography>
                </Box>
            )
        },
        {
            id: 'logout',
            label: 'Logout (CSV / App)',
            sortable: false,
            render: (row) => (
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>CSV: {row.csvLastOut || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">App: {formatTimeOnly(row.appLastLogout)}</Typography>
                </Box>
            )
        },
        {
            id: 'workedHours',
            label: 'App Hours',
            sortable: true,
            render: (row) => (
                <Typography variant="body2" sx={{ fontWeight: 600, color: row.appWorkedHours < 8 ? '#d32f2f' : '#2e7d32' }}>
                    {row.appWorkedHours.toFixed(1)} hrs
                </Typography>
            )
        },
        {
            id: 'status',
            label: 'Validation Status',
            sortable: true,
            render: (row) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Chip
                        label={row.isValid ? 'Valid' : 'Discrepancy'}
                        size="small"
                        color={row.isValid ? 'success' : 'error'}
                    />
                    {!row.isValid && row.errorReasons.map((err, i) => (
                        <Typography key={i} variant="caption" color="error" sx={{ lineHeight: 1.1 }}>
                            • {err}
                        </Typography>
                    ))}
                </Box>
            )
        }
    ];

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ fontWeight: 600, color: "#333" }}>
                Attendance Verification ({period?.label})
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <Box>
                        <Typography variant="body2" color="textSecondary">
                            Upload the gate attendance CSV to validate against the app's records.
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            CSV must contain headers: <b>enrollment, entrydate, firstIn, lastOut</b>.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {canVerify && (
                            <>
                                <input
                                    type="file"
                                    accept=".csv"
                                    style={{ display: 'none' }}
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    startIcon={<UploadIcon />}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Upload CSV
                                </Button>

                                <Button
                                    variant="contained"
                                    color={isVerified ? "success" : "primary"}
                                    onClick={handleVerify}
                                    disabled={isVerifying || isVerified}
                                >
                                    {isVerifying ? 'Verifying...' : isVerified ? 'Verified' : 'Mark as Verified'}
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>

                {loadingAppRecords ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ p: 2 }}>
                        {csvRecords.length === 0 && !isLoadedVerified && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                CSV file not uploaded yet. Showing only App attendance records for this period.
                            </Alert>
                        )}
                        {isLoadedVerified && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                Viewing historically verified attendance log for this cycle.
                            </Alert>
                        )}
                        <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none' }}>
                            <Table
                                columns={columns}
                                data={combinedData}
                                pagination={false}
                            />
                        </Paper>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default VerificationModal;
