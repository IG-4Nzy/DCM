import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper, Button, IconButton, Typography, Checkbox, FormControlLabel, Grid } from '@mui/material';
import { MdDelete as DeleteIcon, MdEdit as EditIcon, MdAdd as AddIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { useToast } from '../../contexts/ToastContext';
import { useTableState } from '../../hooks/useTableState';
import { fetchVisitorLogs, createVisitorLog, updateVisitorLog, deleteVisitorLog } from './action';
import type { VisitorLogData } from './model';
import type { RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

type Order = 'asc' | 'desc';

const VisitorLogs: React.FC = () => {
    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);

    const [logs, setLogs] = useState<VisitorLogData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // CRUD States
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<VisitorLogData | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<VisitorLogData | null>(null);

    const [formFields, setFormFields] = useState({
        visitorName: '',
        division: '',
        purpose: '',
        itemsToBring: '',
        keptItemsOnExit: false,
        entryTime: '',
        exitTime: ''
    });

    const [page, setPage] = useTableState('visitor_logs_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('visitor_logs_rowsPerPage', 10);
    const [searchQuery, setSearchQuery] = useTableState('visitor_logs_search', '');
    const [order, setOrder] = useTableState<Order>('visitor_logs_order', 'desc');
    const [orderBy, setOrderBy] = useTableState<string>('visitor_logs_orderBy', 'entryTime');

    const hasViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.VISITOR_LOGS_VIEW) || hasPrivilege(PRIVILEGES.REQUEST_VIEW);
    const canCreate = isSuperuser || hasPrivilege(PRIVILEGES.VISITOR_LOGS_CREATE);
    const canUpdate = isSuperuser || hasPrivilege(PRIVILEGES.VISITOR_LOGS_UPDATE);
    const canDelete = isSuperuser || hasPrivilege(PRIVILEGES.VISITOR_LOGS_DELETE);

    const loadData = useCallback(async () => {
        if (!hasViewPrivilege) return;
        try {
            setLoading(true);
            const res = await fetchVisitorLogs({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
            });
            setLogs(res.data);
            setTotalCount(res.total);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch visitor logs', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, showToast, hasViewPrivilege]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const formatToDatetimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const toISOString = (dtString?: string) => {
        if (!dtString) return '';
        const d = new Date(dtString);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    };

    const handleAddClick = () => {
        setEditingLog(null);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const localNow = `${year}-${month}-${day}T${hours}:${minutes}`;

        setFormFields({
            visitorName: '',
            division: '',
            purpose: '',
            itemsToBring: '',
            keptItemsOnExit: false,
            entryTime: localNow,
            exitTime: ''
        });
        setIsFormModalOpen(true);
    };

    const handleEditClick = (log: VisitorLogData) => {
        setEditingLog(log);
        setFormFields({
            visitorName: log.visitorName || '',
            division: log.division || '',
            purpose: log.purpose || '',
            itemsToBring: log.itemsToBring || '',
            keptItemsOnExit: log.keptItemsOnExit || false,
            entryTime: formatToDatetimeLocal(log.entryTime),
            exitTime: formatToDatetimeLocal(log.exitTime)
        });
        setIsFormModalOpen(true);
    };

    const handleDeleteClick = (log: VisitorLogData) => {
        setDeleteTarget(log);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || !deleteTarget._id) return;
        try {
            await deleteVisitorLog(deleteTarget._id);
            showToast('Visitor log deleted successfully', 'success');
            setDeleteTarget(null);
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to delete visitor log', 'error');
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formFields.visitorName.trim()) {
            showToast('Visitor Name is required', 'error');
            return;
        }
        if (!formFields.division.trim()) {
            showToast('Division is required', 'error');
            return;
        }
        if (!formFields.purpose.trim()) {
            showToast('Purpose is required', 'error');
            return;
        }
        if (!formFields.entryTime) {
            showToast('Entry Time is required', 'error');
            return;
        }

        const payload = {
            visitorName: formFields.visitorName.trim(),
            division: formFields.division.trim(),
            purpose: formFields.purpose.trim(),
            itemsToBring: formFields.itemsToBring.trim(),
            keptItemsOnExit: formFields.keptItemsOnExit,
            entryTime: toISOString(formFields.entryTime),
            exitTime: formFields.exitTime ? toISOString(formFields.exitTime) : ""
        };

        try {
            if (editingLog && editingLog._id) {
                await updateVisitorLog(editingLog._id, payload);
                showToast('Visitor log updated successfully', 'success');
            } else {
                await createVisitorLog(payload);
                showToast('Visitor log created successfully', 'success');
            }
            setIsFormModalOpen(false);
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to save visitor log', 'error');
        }
    };

    const cleanAndFormatTime = (timeStr?: string) => {
        if (!timeStr) return '-';
        const cleaned = timeStr.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z');
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? timeStr : d.toLocaleString();
    };

    const columns: Column<VisitorLogData>[] = [
        { 
            id: 'visitorName', 
            label: 'Visitor Name', 
            sortable: false,
            render: (row) => row.visitorName || '-'
        },
        {
            id: 'division',
            label: 'Division',
            sortable: false,
            render: (row) => row.division || '-'
        },
        {
            id: 'purpose',
            label: 'Purpose',
            sortable: false,
            render: (row) => row.purpose || '-'
        },
        {
            id: 'itemsToBring',
            label: 'Tools / Items',
            sortable: false,
            render: (row) => row.itemsToBring || '-'
        },
        {
            id: 'keptItemsOnExit',
            label: 'Kept on Exit?',
            sortable: false,
            render: (row) => row.itemsToBring ? (row.keptItemsOnExit ? 'Yes' : 'No') : '-'
        },
        { 
            id: 'entryTime', 
            label: 'Entry Time', 
            sortable: true,
            render: (row) => cleanAndFormatTime(row.entryTime)
        },
        {
            id: 'exitTime',
            label: 'Exit Time',
            sortable: true,
            render: (row) => cleanAndFormatTime(row.exitTime)
        },
        {
            id: 'loggedBy',
            label: 'Logged By',
            sortable: false,
            render: (row) => row.loggedBy || '-'
        }
    ];

    if (canUpdate || canDelete) {
        columns.push({
            id: 'actions',
            label: 'Actions',
            sortable: false,
            align: 'center',
            render: (row) => (
                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    {canUpdate && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditClick(row); }} sx={{ color: '#3b82f6', p: 0.5 }}>
                            <EditIcon size={16} />
                        </IconButton>
                    )}
                    {canDelete && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }} sx={{ color: '#ef4444', p: 0.5 }}>
                            <DeleteIcon size={16} />
                        </IconButton>
                    )}
                </Box>
            )
        });
    }

    if (!hasViewPrivilege) {
        return (
            <Box sx={{ p: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Access Denied</h2>
                <p>You do not have permission to view Visitor Logs.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Visitor Logs</h2>
                {canCreate && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddClick}
                        sx={{ background: '#3b82f6', '&:hover': { background: '#2563eb' } }}
                    >
                        Add Log
                    </Button>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
                <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(0); }} placeholder="Search visitor logs by name, division, purpose..." sx={{ width: '400px' }} />
            </Box>

            <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                <Table
                    columns={columns}
                    data={logs}
                    loading={loading}
                    orderBy={orderBy}
                    order={order}
                    onRequestSort={(prop) => handleRequestSort(prop as string)}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    totalCount={totalCount}
                />
            </Paper>

            {/* Create/Update Modal */}
            <Modal
                open={isFormModalOpen}
                handleClose={() => setIsFormModalOpen(false)}
                title={editingLog ? 'Edit Visitor Log' : 'New Visitor Log'}
            >
                <form onSubmit={handleFormSubmit}>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Visitor Name"
                                value={formFields.visitorName}
                                onChange={(e) => setFormFields({ ...formFields, visitorName: e.target.value })}
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Division / Dept"
                                value={formFields.division}
                                onChange={(e) => setFormFields({ ...formFields, division: e.target.value })}
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Purpose of Visit"
                                value={formFields.purpose}
                                onChange={(e) => setFormFields({ ...formFields, purpose: e.target.value })}
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Tools / Items to Bring"
                                value={formFields.itemsToBring}
                                onChange={(e) => setFormFields({ ...formFields, itemsToBring: e.target.value })}
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Entry Time"
                                type="datetime-local"
                                value={formFields.entryTime}
                                onChange={(e) => setFormFields({ ...formFields, entryTime: e.target.value })}
                                required
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Exit Time"
                                type="datetime-local"
                                value={formFields.exitTime}
                                onChange={(e) => setFormFields({ ...formFields, exitTime: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        {formFields.itemsToBring.trim() && (
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formFields.keptItemsOnExit}
                                            onChange={(e) => setFormFields({ ...formFields, keptItemsOnExit: e.target.checked })}
                                            size="small"
                                        />
                                    }
                                    label={<Typography sx={{ fontSize: '0.85rem' }}>Kept tools / items on exit?</Typography>}
                                />
                            </Grid>
                        )}
                    </Grid>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                        <Button size="small" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
                        <Button size="small" type="submit" variant="contained" sx={{ background: '#3b82f6', '&:hover': { background: '#2563eb' } }}>
                            Save
                        </Button>
                    </Box>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={Boolean(deleteTarget)}
                handleClose={() => setDeleteTarget(null)}
                title="Confirm Deletion"
            >
                <Box sx={{ p: 0.5 }}>
                    <Typography sx={{ mb: 2, fontSize: '0.9rem', color: '#1e293b' }}>
                        Are you sure you want to delete the visitor log for <strong>{deleteTarget?.visitorName}</strong>? This action cannot be undone.
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={handleConfirmDelete}
                            sx={{ background: '#ef4444', '&:hover': { background: '#dc2626' } }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
};

export default VisitorLogs;
