// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, Chip, ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import TextField from '../../components/TextField';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTableState } from '../../hooks/useTableState';
import { fetchRequests, createRequest, updateRequest, deleteRequest, advanceRequest, sendBackwardRequest } from './action';
import type { RequestData } from './model';
import type { RootState, AppDispatch } from '../../store';
import RequestFormModal from './RequestFormModal';
import RequestViewModal from './RequestViewModal';
import request from '../../services/request';

// Need fetchUsers to show creator name properly
import { fetchUsers } from '../Users/action';
import { fetchInventory } from '../Inventory/action';

// Import auth privileges
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

type Order = 'asc' | 'desc';

const Requests: React.FC = () => {
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const dispatch = useDispatch<AppDispatch>();
    const { isSuperuser, username } = useSelector((state: RootState) => state.auth);
    const { users } = useSelector((state: RootState) => state.users);
    const { inventory } = useSelector((state: RootState) => state.inventory);

    const [requests, setRequests] = useState<RequestData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useTableState('requests_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('requests_rowsPerPage', 5);
    const [searchQuery, setSearchQuery] = useTableState('requests_search', '');
    const [order, setOrder] = useTableState<Order>('requests_order', 'desc');
    const [orderBy, setOrderBy] = useTableState<string>('requests_orderBy', 'createdAt');
    const [statusFilter, setStatusFilter] = useTableState<'all' | 'completed' | 'active'>('requests_statusFilter', 'all');
    const [requestTypeFilter, setRequestTypeFilter] = useTableState<string>('requests_requestTypeFilter', 'all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<RequestData | null>(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedViewRequest, setSelectedViewRequest] = useState<RequestData | null>(null);

    const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests');
    const [editingType, setEditingType] = useState<{id: string, name: string} | null>(null);
    const [requestTypesObj, setRequestTypesObj] = useState<{id: string, name: string}[]>([
        { id: '1', name: 'VM Creation' },
        { id: '2', name: 'VM Management' },
        { id: '3', name: 'DC Entry' },
        { id: '4', name: 'Hardware Issuance' },
        { id: '5', name: 'Hardware Replacement' }
    ]);
    const requestTypes = requestTypesObj.map(t => t.name);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');

    const hasCreatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_CREATE);
    const hasViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_VIEW);
    const hasUpdatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_UPDATE);
    const hasDeletePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_DELETE);

    const hasTypeViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_TYPE_VIEW);
    const hasTypeCreatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_TYPE_CREATE);
    const hasTypeUpdatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_TYPE_UPDATE);
    const hasTypeDeletePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_TYPE_DELETE);

    const loadData = useCallback(async (silent = false) => {
        if (!hasViewPrivilege) return;
        try {
            if (!silent) setLoading(true);
            let completedParam: boolean | undefined = undefined;
            if (statusFilter === 'completed') completedParam = true;
            else if (statusFilter === 'active') completedParam = false;

            const res = await fetchRequests({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                completed: completedParam,
                requestType: requestTypeFilter === 'all' ? undefined : requestTypeFilter,
            });
            setRequests(res.data);
            setTotalCount(res.total);
            
            // If the view modal is open, refresh its data too
            if (isViewModalOpen && selectedViewRequest) {
                const reqId = selectedViewRequest.id || selectedViewRequest._id;
                const updatedReq = res.data.find((r: RequestData) => (r.id || r._id) === reqId);
                if (updatedReq) {
                    setSelectedViewRequest(updatedReq);
                }
            }
        } catch (err: any) {
            if (!silent) showToast(err.message || 'Failed to fetch requests', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, statusFilter, requestTypeFilter, showToast, hasViewPrivilege, isViewModalOpen, selectedViewRequest]);

    const fetchRequestTypes = useCallback(async () => {
        try {
            const res = await request.get('/api/requests/types');
            if (res.data && Array.isArray(res.data)) {
                setRequestTypesObj(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch request types:', err);
        }
    }, []);

    useEffect(() => {
        loadData();
        fetchRequestTypes();
        dispatch(fetchUsers({ pagination: false }));
        dispatch(fetchInventory({ pagination: false }));
    }, [loadData, fetchRequestTypes, dispatch]);

    useEffect(() => {
        if (!hasViewPrivilege) return;
        const interval = setInterval(() => {
            if (document.hidden) return;
            loadData(true);
        }, 60000); // 60s background sync
        return () => clearInterval(interval);
    }, [loadData, hasViewPrivilege]);

    const handleSaveRequestType = async () => {
        if (!newTypeName.trim()) {
            showToast('Request type name cannot be empty', 'error');
            return;
        }
        try {
            setLoading(true);
            if (editingType) {
                await request.put(`/api/requests/types/${editingType.id}`, { name: newTypeName.trim() });
                showToast('Request type updated successfully', 'success');
            } else {
                await request.post('/api/requests/types', { name: newTypeName.trim() });
                showToast('Request type created successfully', 'success');
            }
            setNewTypeName('');
            setEditingType(null);
            setIsTypeModalOpen(false);
            await fetchRequestTypes();
        } catch (err: any) {
            showToast(err.response?.data?.detail || err.message || 'Failed to save request type', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEditRequestType = (typeObj: {id: string, name: string}) => {
        setEditingType(typeObj);
        setNewTypeName(typeObj.name);
        setIsTypeModalOpen(true);
    };

    const handleDeleteRequestType = async (id: string) => {
        if (await confirm("Are you sure you want to delete this request type?")) {
            try {
                setLoading(true);
                await request.delete(`/api/requests/types/${id}`);
                showToast('Request type deleted successfully', 'success');
                await fetchRequestTypes();
            } catch (err: any) {
                showToast(err.response?.data?.detail || err.message || 'Failed to delete request type', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleOpenModal = (req?: RequestData) => {
        setEditingRequest(req || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRequest(null);
    };

    const handleRowClick = (req: RequestData) => {
        setSelectedViewRequest(req);
        setIsViewModalOpen(true);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedViewRequest(null);
    };

    const handleSubmit = async (data: Partial<RequestData>) => {
        try {
            if (editingRequest) {
                await updateRequest(editingRequest.id || editingRequest._id || '', data);
                showToast('Request updated successfully', 'success');
            } else {
                await createRequest(data);
                showToast('Request created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to save request', 'error');
            throw err;
        }
    };

    const handleAdvance = async (id: string) => {
        if (await confirm("Are you sure you want to approve/advance this request to the next stage?")) {
            try {
                setLoading(true);
                await advanceRequest(id);
                showToast('Request advanced to the next stage successfully', 'success');
                loadData();
            } catch (err: any) {
                showToast(err.message || 'Failed to advance request', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleAdvanceWithPayload = async (id: string, payload?: any) => {
        try {
            setLoading(true);
            await advanceRequest(id, payload);
            showToast('Request advanced to the next stage successfully', 'success');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to advance request', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectWithRemarks = async (id: string, remarksText: string) => {
        try {
            setLoading(true);
            await updateRequest(id, { status: 'Rejected', remarks: remarksText });
            showToast('Request rejected successfully', 'success');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to reject request', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendBack = async (id: string, reason: string) => {
        try {
            setLoading(true);
            await sendBackwardRequest(id, reason);
            showToast('Request sent back to previous stage successfully', 'success');
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Failed to send back request', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirm("Are you sure you want to delete this request?")) {
            try {
                await deleteRequest(id);
                showToast('Request deleted successfully', 'success');
                if (requests.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (err: any) {
                showToast(err.message || 'Failed to delete request', 'error');
            }
        }
    };

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'warning';
            case 'In Progress': return 'info';
            case 'Completed': return 'success';
            case 'Rejected': return 'error';
            default: return 'default';
        }
    };

    const typeColumns: Column<{id: string, name: string}>[] = [
        {
            id: 'name',
            label: 'Request Type Name',
            sortable: false,
            render: (row) => row.name
        },
        {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            render: (row) => (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {hasTypeUpdatePrivilege && (
                        <Tooltip title="Edit Request Type">
                            <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleEditRequestType(row); }}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {hasTypeDeletePrivilege && (
                        <Tooltip title="Delete Request Type">
                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteRequestType(row.id); }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        }
    ];

    const columns: Column<RequestData>[] = [
        { 
            id: 'requestId', 
            label: 'Request ID', 
            sortable: false,
            render: (row) => (
                <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
                    {row.requestId || '-'}
                </span>
            )
        },
        { 
            id: 'requestType', 
            label: 'Request Type', 
            sortable: true,
            render: (row) => row.requestType || row.category || '-'
        },
        {
            id: 'details',
            label: 'Details',
            sortable: false,
            render: (row) => {
                const parts = [];
                const purp = row.purpose || row.details?.purpose;
                if (purp) {
                    parts.push(`Purpose: ${purp}`);
                }

                if (row.details) {
                    if (row.requestType === 'VM Creation' || row.requestType === 'VM Management') {
                        const vmNameVal = row.details.vmName || row.details.applications || row.details.vmId;
                        if (vmNameVal) parts.push(`VM: ${vmNameVal}`);
                        if (row.details.osVersion) parts.push(`OS: ${row.details.osVersion}`);
                        if (row.details.ram) parts.push(`RAM: ${row.details.ram}`);
                    } else if (row.requestType === 'DC Entry') {
                        if (row.details.dateTime) parts.push(`Time: ${new Date(row.details.dateTime).toLocaleString()}`);
                    } else if (row.requestType === 'Hardware Issuance') {
                        const hItem = inventory.find((i: any) => (i.id || i._id) === row.details.hardwareId);
                        const hName = hItem ? hItem.itemName : (row.details.hardwareItem || row.details.hardwareId || '-');
                        if (hName) parts.push(`Item: ${hName}`);
                        if (row.details.quantity) parts.push(`Qty: ${row.details.quantity}`);
                    } else if (row.requestType === 'Hardware Replacement') {
                        if (row.details.remarks) parts.push(`Remarks: ${row.details.remarks}`);
                    }
                }
                
                const text = parts.join(' | ') || row.description || '';
                return (
                    <span style={{
                        display: 'inline-block',
                        maxWidth: '250px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }} title={text}>
                        {text || '-'}
                    </span>
                );
            }
        },
        {
            id: 'status',
            label: 'Status',
            sortable: true,
            render: (row) => (
                <Chip label={row.status} size="small" color={getStatusColor(row.status) as any} />
            )
        },
        {
            id: 'currentAssignedUsers',
            label: 'Current Assignee',
            sortable: false,
            render: (row) => {
                if (!row.currentAssignedUsers || row.currentAssignedUsers.length === 0) return '-';
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {row.currentAssignedUsers.map((username, i) => {
                            const u = users.find((user: any) => user.username === username);
                            const displayName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : (row.currentAssignedUsersFullName?.[i] || username);
                            return <Chip key={i} label={displayName} size="small" variant="outlined" color="primary" />;
                        })}
                    </Box>
                );
            }
        },
        {
            id: 'createdBy',
            label: 'Created By',
            sortable: true,
            render: (row) => {
                const u = users.find((user: any) => user.username === row.createdBy);
                return u ? u.firstName || u.username : (row.createdByFullName || row.createdBy);
            }
        },
        {
            id: 'createdAt',
            label: 'Created At',
            sortable: true,
            render: (row) => new Date(row.createdAt).toLocaleString()
        },
        {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            render: (row) => {
                const isAssigned = row.currentAssignedUsers && row.currentAssignedUsers.includes(username);
                const isStage1 = row.currentStageIndex === 0 || row.currentStageIndex === undefined || row.currentStageIndex === null;
                const canEdit = isSuperuser || (isStage1 && row.status !== 'Completed' && row.status !== 'Rejected' && (hasUpdatePrivilege || row.createdBy === username || isAssigned));
                const canDelete = isSuperuser || hasDeletePrivilege || (row.createdBy === username && isStage1 && row.status !== 'Completed' && row.status !== 'Rejected');
                const canAdvance = (isAssigned || isSuperuser) && row.status !== 'Completed' && row.status !== 'Rejected';

                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {/* {canAdvance && (
                            <Tooltip title="Advance / Approve Stage">
                                <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); handleAdvance(row.id || row._id || ''); }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                                </IconButton>
                            </Tooltip>
                        )} */}
                        {canEdit && (
                            <Tooltip title="Edit Request">
                                <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {canDelete && (
                            <Tooltip title="Delete Request">
                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row.id || row._id || ''); }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            }
        }
    ];

    if (!hasViewPrivilege) {
        return (
            <Box sx={{ p: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Access Denied</h2>
                <p>You do not have permission to view Requests.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Requests</h2>
            </Box>

            <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val as any)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Requests List" value="requests" />
                {hasTypeViewPrivilege && <Tab label="Request Types" value="types" />}
            </Tabs>

            {activeTab === 'requests' ? (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(0); }} placeholder="Search requests..." />
                            <ToggleButtonGroup
                                value={statusFilter}
                                exclusive
                                onChange={(e, val) => {
                                    if (val) {
                                        setStatusFilter(val);
                                        setPage(0);
                                    }
                                }}
                                aria-label="status filter"
                                size="small"
                                sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 0.5, borderRadius: '8px' }}
                            >
                                <ToggleButton value="all" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                                    All
                                </ToggleButton>
                                <ToggleButton value="active" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                                    Non Completed
                                </ToggleButton>
                                <ToggleButton value="completed" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                                    Completed
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel id="request-type-filter-label">Request Type</InputLabel>
                                <Select
                                    labelId="request-type-filter-label"
                                    value={requestTypeFilter}
                                    label="Request Type"
                                    onChange={(e) => {
                                        setRequestTypeFilter(e.target.value);
                                        setPage(0);
                                    }}
                                    sx={{ bgcolor: '#fff' }}
                                >
                                    <MenuItem value="all">All Request Types</MenuItem>
                                    {requestTypes.map((type) => (
                                        <MenuItem key={type} value={type}>{type}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {hasCreatePrivilege && (
                            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
                                Create Request
                            </Button>
                        )}
                    </Box>

                    <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                        <Table
                            columns={columns}
                            data={requests}
                            loading={loading}
                            orderBy={orderBy}
                            order={order}
                            onRequestSort={(prop) => handleRequestSort(prop as string)}
                            page={page}
                            rowsPerPage={rowsPerPage}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            totalCount={totalCount}
                            onRowClick={handleRowClick}
                        />
                    </Paper>
                </>
            ) : (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                        {hasTypeCreatePrivilege && (
                            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => { setEditingType(null); setNewTypeName(''); setIsTypeModalOpen(true); }}>
                                Add Request Type
                            </Button>
                        )}
                    </Box>
                    <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                        <Table
                            columns={typeColumns}
                            data={requestTypesObj}
                            loading={loading}
                            page={0}
                            rowsPerPage={100}
                            onPageChange={() => {}}
                            onRowsPerPageChange={() => {}}
                            totalCount={requestTypesObj.length}
                        />
                    </Paper>
                </>
            )}

            <RequestFormModal
                isModalOpen={isModalOpen}
                handleCloseModal={handleCloseModal}
                editingRequest={editingRequest}
                onSubmit={handleSubmit}
                isSuperuser={isSuperuser}
                requestTypes={requestTypes}
            />

            <Dialog open={isTypeModalOpen} onClose={() => { setIsTypeModalOpen(false); setEditingType(null); setNewTypeName(''); }} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 1, fontWeight: 'bold', fontSize: '1.25rem', color: '#333' }}>
                    {editingType ? 'Edit Request Type' : 'Add Request Type'}
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            label="Request Type Name"
                            fullWidth
                            required
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="e.g. Server Access"
                            autoFocus
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => { setIsTypeModalOpen(false); setEditingType(null); setNewTypeName(''); }} variant="text" color="inherit">
                        Cancel
                    </Button>
                    <Button onClick={handleSaveRequestType} variant="contained" color="primary" disabled={loading}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <RequestViewModal
                isOpen={isViewModalOpen}
                onClose={handleCloseViewModal}
                request={selectedViewRequest}
                onAdvance={handleAdvanceWithPayload}
                onReject={handleRejectWithRemarks}
                onSendBack={handleSendBack}
                username={username}
                isSuperuser={isSuperuser}
                hasUpdatePrivilege={hasUpdatePrivilege}
            />
        </Box>
    );
};

export default Requests;