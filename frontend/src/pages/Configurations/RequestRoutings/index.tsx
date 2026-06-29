// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tooltip, IconButton, Chip } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import SearchBar from '../../../components/SearchBar';
import Table, { type Column } from '../../../components/Table';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { useTableState } from '../../../hooks/useTableState';
import { fetchRequestRoutings, createRequestRouting, updateRequestRouting, deleteRequestRouting } from './action';
import type { RequestRoutingData } from './model';
import RequestRoutingModal from './RequestRoutingModal';

type Order = 'asc' | 'desc';

const RequestRoutings = () => {
    const [data, setData] = useState<RequestRoutingData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RequestRoutingData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_DELETE);

    const [searchQuery, setSearchQuery] = useTableState('requestRoutings_search', '');
    const [page, setPage] = useTableState('requestRoutings_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('requestRoutings_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('requestRoutings_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('requestRoutings_orderBy', 'requestType');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchRequestRoutings({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true,
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load request routings', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: RequestRoutingData) => {
        setEditingItem(item || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleSubmit = async (payload: any) => {
        try {
            if (editingItem) {
                await updateRequestRouting(payload);
                showToast('Request routing updated successfully', 'success');
            } else {
                await createRequestRouting(payload);
                showToast('Request routing created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save request routing', 'error');
        }
    };

    const handleDelete = async (item: RequestRoutingData) => {
        const isConfirmed = await confirm(
            `Are you sure you want to delete the routing for "${item.requestType}"?`,
            'Delete Request Routing'
        );
        if (isConfirmed) {
            try {
                await deleteRequestRouting(item.id || item._id || '');
                showToast('Request routing deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete request routing', 'error');
            }
        }
    };

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const columns: Column<RequestRoutingData>[] = [
        { id: 'requestType', label: 'Request Type', sortable: true },
        {
            id: 'stages',
            label: 'Statuses',
            sortable: false,
            render: (row) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(row.stages || []).map((stage, i) => (
                        <Chip
                            key={i}
                            label={`${i + 1}. ${stage.stageName}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                        />
                    ))}
                    {(!row.stages || row.stages.length === 0) && '-'}
                </Box>
            ),
        },
        {
            id: 'assignees',
            label: 'Assignees',
            sortable: false,
            render: (row) => {
                const stagesWithAssignment = (row.stages || []).filter(
                    (s) => s.assignedTo || s.assignmentType === 'RequesterDeptHead'
                );
                if (stagesWithAssignment.length === 0) return '-';
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {stagesWithAssignment.map((stage, i) => {
                            let label = stage.stageName + ': ';
                            if (stage.assignmentType === 'RequesterDeptHead') {
                                label += 'Dept Head';
                            } else if (stage.assignmentType === 'DeptStaffs') {
                                label += `${stage.assignedTo} Staffs`;
                            } else if (stage.assignmentType === 'Role') {
                                label += `${stage.assignedTo} Role`;
                            } else {
                                label += stage.assignedTo;
                            }
                            return (
                                <Chip
                                    key={i}
                                    label={label}
                                    size="small"
                                    variant="filled"
                                    color={
                                        stage.assignmentType === 'RequesterDeptHead'
                                            ? 'warning'
                                            : stage.assignmentType === 'DeptStaffs'
                                            ? 'secondary'
                                            : stage.assignmentType === 'Role'
                                            ? 'success'
                                            : 'info'
                                    }
                                />
                            );
                        })}
                    </Box>
                );
            },
        },
    ];

    if (hasUpdate || hasDelete) {
        columns.push({
            id: 'id',
            label: 'Actions',
            align: 'right',
            sortable: false,
            render: (row) => (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {hasUpdate && (
                        <Tooltip title="Edit">
                            <IconButton
                                size="small"
                                color="primary"
                                sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}
                                onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {hasDelete && (
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                color="error"
                                sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }}
                                onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            ),
        });
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search request routings..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Routing
                        </Button>
                    )}
                </Box>
            </Box>

            <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                <Table
                    columns={columns}
                    data={data}
                    totalCount={totalCount}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    orderBy={orderBy}
                    order={order}
                    onRequestSort={handleRequestSort}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    loading={loading}
                />
            </Paper>

            <RequestRoutingModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default RequestRoutings;
