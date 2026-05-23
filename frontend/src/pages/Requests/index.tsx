import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, Chip } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTableState } from '../../hooks/useTableState';
import { fetchRequests, createRequest, updateRequest, deleteRequest, advanceRequest } from './action';
import type { RequestData } from './model';
import type { RootState, AppDispatch } from '../../store';
import RequestFormModal from './RequestFormModal';
import RequestViewModal from './RequestViewModal';

// Need fetchUsers to show creator name properly
import { fetchUsers } from '../Users/action';

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

    const [requests, setRequests] = useState<RequestData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useTableState('requests_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('requests_rowsPerPage', 5);
    const [searchQuery, setSearchQuery] = useTableState('requests_search', '');
    const [order, setOrder] = useTableState<Order>('requests_order', 'desc');
    const [orderBy, setOrderBy] = useTableState<string>('requests_orderBy', 'createdAt');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<RequestData | null>(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedViewRequest, setSelectedViewRequest] = useState<RequestData | null>(null);

    const hasCreatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_CREATE);
    const hasViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_VIEW);
    const hasUpdatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_UPDATE);
    const hasDeletePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.REQUEST_DELETE);

    const loadData = useCallback(async () => {
        if (!hasViewPrivilege) return;
        try {
            setLoading(true);
            const res = await fetchRequests({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
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
            showToast(err.message || 'Failed to fetch requests', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, showToast, hasViewPrivilege, isViewModalOpen, selectedViewRequest]);

    useEffect(() => {
        loadData();
        dispatch(fetchUsers({ pagination: false }));
    }, [loadData, dispatch]);

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

    const columns: Column<RequestData>[] = [
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
                let text = row.description || '';
                if (row.details) {
                    const parts = [];
                    if (row.requestType === 'VM Creation') {
                        if (row.details.osVersion) parts.push(`OS: ${row.details.osVersion}`);
                        if (row.details.ram) parts.push(`RAM: ${row.details.ram}`);
                    } else if (row.requestType === 'DC Entry') {
                        if (row.details.dateTime) parts.push(`Time: ${new Date(row.details.dateTime).toLocaleString()}`);
                        if (row.details.purpose) parts.push(`Purpose: ${row.details.purpose}`);
                    } else if (row.requestType === 'Hardware Issuance') {
                        if (row.details.quantity) parts.push(`Qty: ${row.details.quantity}`);
                    } else if (row.requestType === 'Hardware Replacement') {
                        if (row.details.remarks) parts.push(`Remarks: ${row.details.remarks}`);
                    }
                    text = parts.join(' | ') || text;
                }
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
                        {row.currentAssignedUsers.map((user, i) => (
                            <Chip key={i} label={user} size="small" variant="outlined" color="primary" />
                        ))}
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
                return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : row.createdBy;
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
                const canEdit = hasUpdatePrivilege || (row.createdBy === username && row.status === 'Pending') || isAssigned;
                const canDelete = hasDeletePrivilege || (row.createdBy === username && row.status === 'Pending' && hasDeletePrivilege);
                const canAdvance = (isAssigned || isSuperuser) && row.status !== 'Completed' && row.status !== 'Rejected';

                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {canAdvance && (
                            <Tooltip title="Advance / Approve Stage">
                                <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); handleAdvance(row.id || row._id || ''); }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                                </IconButton>
                            </Tooltip>
                        )}
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

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search requests..." />
                </Box>

                {hasCreatePrivilege && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
                            Create Request
                        </Button>
                    </Box>
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

            <RequestFormModal
                isModalOpen={isModalOpen}
                handleCloseModal={handleCloseModal}
                editingRequest={editingRequest}
                onSubmit={handleSubmit}
                isSuperuser={isSuperuser}
            />

            <RequestViewModal
                isOpen={isViewModalOpen}
                onClose={handleCloseViewModal}
                request={selectedViewRequest}
                onAdvance={handleAdvanceWithPayload}
                onReject={handleRejectWithRemarks}
                username={username}
                isSuperuser={isSuperuser}
                hasUpdatePrivilege={hasUpdatePrivilege}
            />
        </Box>
    );
};

export default Requests;