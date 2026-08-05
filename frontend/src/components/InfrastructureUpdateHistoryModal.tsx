// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    CircularProgress,
    IconButton,
    TextField,
    InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import ComputerIcon from '@mui/icons-material/Computer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import request from '../services/request';

interface FieldChange {
    field: string;
    fieldName: string;
    from: string;
    to: string;
}

interface HistoryLog {
    _id: string;
    entityType: string;
    entityId: string;
    entityName: string;
    vmId?: string;
    ipAddress?: string;
    hostName?: string;
    username: string;
    userIp: string;
    timestamp: string;
    changes: FieldChange[];
}

interface InfrastructureUpdateHistoryModalProps {
    open: boolean;
    onClose: () => void;
    entityId: string;
    entityName: string;
    entityTypeLabel?: string;
}

const InfrastructureUpdateHistoryModal: React.FC<InfrastructureUpdateHistoryModalProps> = ({
    open,
    onClose,
    entityId,
    entityName,
    entityTypeLabel = "Item"
}) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [history, setHistory] = useState<HistoryLog[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        if (open && entityId) {
            fetchHistory();
        }
    }, [open, entityId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await request.get(`/api/infrastructure-history/${entityId}`);
            setHistory(res.data?.data || []);
        } catch (err) {
            console.error("Failed to fetch update history", err);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredHistory = history.filter(log => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            log.entityId?.toLowerCase().includes(term) ||
            log.entityName?.toLowerCase().includes(term) ||
            log.vmId?.toLowerCase().includes(term) ||
            log.ipAddress?.toLowerCase().includes(term) ||
            log.hostName?.toLowerCase().includes(term) ||
            log.username?.toLowerCase().includes(term) ||
            log.userIp?.toLowerCase().includes(term) ||
            log.changes?.some(c => 
                c.field?.toLowerCase().includes(term) || 
                c.fieldName?.toLowerCase().includes(term) ||
                c.from?.toLowerCase().includes(term) || 
                c.to?.toLowerCase().includes(term)
            )
        );
    });

    const formatDate = (isoString: string) => {
        if (!isoString) return '--';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch {
            return isoString;
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#1a1f2c', color: '#fff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon sx={{ color: '#40a9ff' }} />
                    <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
                        Update History - {entityName}
                    </Typography>
                    <Chip label={entityTypeLabel} size="small" color="primary" sx={{ ml: 1, textTransform: 'uppercase', fontSize: '11px' }} />
                </Box>
                <Button onClick={onClose} sx={{ color: '#aaa', minWidth: 'auto', p: 0.5 }}>
                    ✕
                </Button>
            </DialogTitle>
            
            <DialogContent dividers sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Search by VM/Node ID, User, IP, or Field..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ width: 360, bgcolor: '#fff' }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" sx={{ color: '#888' }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Total Updates Logged: {history.length}
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
                        <CircularProgress size={36} />
                        <Typography sx={{ ml: 2, color: '#64748b' }}>Loading history logs...</Typography>
                    </Box>
                ) : filteredHistory.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6, px: 2, bgcolor: '#fff', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                        <HistoryIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography variant="h6" sx={{ color: '#475569', fontWeight: 600 }}>
                            No Update History Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                            {searchTerm ? "No logs match your search filter." : "No update records have been logged for this item yet."}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredHistory.map((log) => (
                            <Paper key={log._id} elevation={1} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <PersonIcon fontSize="small" sx={{ color: '#2563eb' }} />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                {log.username}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={<ComputerIcon style={{ fontSize: 14 }} />}
                                            label={`IP: ${log.userIp}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 22, fontSize: '11px', color: '#475569', borderColor: '#cbd5e1' }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <AccessTimeIcon fontSize="small" sx={{ color: '#64748b', fontSize: 16 }} />
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                            {formatDate(log.timestamp)}
                                        </Typography>
                                    </Box>
                                </Box>

                                <TableContainer component={Box} sx={{ border: '1px solid #e2e8f0', borderRadius: 1 }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold', color: '#334155', width: '30%' }}>Field Changed</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', color: '#dc2626', width: '35%' }}>Old Value (From)</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', color: '#16a34a', width: '35%' }}>New Value (To)</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {log.changes.map((change, idx) => (
                                                <TableRow key={idx} hover>
                                                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                                                        {change.field}
                                                    </TableCell>
                                                    <TableCell sx={{ color: '#991b1b', bgcolor: '#fef2f2', fontFamily: 'monospace', fontSize: '12px' }}>
                                                        {change.from}
                                                    </TableCell>
                                                    <TableCell sx={{ color: '#166534', bgcolor: '#f0fdf4', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                                                        {change.to}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        ))}
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
                <Button onClick={onClose} variant="contained" color="primary">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default InfrastructureUpdateHistoryModal;
