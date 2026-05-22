import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tooltip, IconButton } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useTableState } from '../../hooks/useTableState';
import { fetchServerDetails, createServerDetails, updateServerDetails, deleteServerDetails } from './action';
import request from '../../services/request';
import { type ServerDetailsData } from './model';
import ServerDetailsModal from './ServerDetailsModal';

type Order = 'asc' | 'desc';

const ServerDetails = () => {
    const [data, setData] = useState<ServerDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ServerDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_DELETE);

    const [searchQuery, setSearchQuery] = useTableState('serverDetails_search', '');
    const [page, setPage] = useTableState('serverDetails_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('serverDetails_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('serverDetails_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('serverDetails_orderBy', 'slNumber');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchServerDetails({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                search: searchQuery,
                pagination: true
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load server details', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        request.get('/api/users/', { params: { pagination: false } }).then(res => {
            const map: Record<string, string> = {};
            res.data.data.forEach((u: any) => {
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                map[u.username] = fullName || u.username;
            });
            setUsersMap(map);
        }).catch(err => console.error("Failed to load users:", err));
    }, []);

    const handleOpenModal = (item?: ServerDetailsData) => {
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
                await updateServerDetails(payload);
                showToast('Server details updated successfully', 'success');
            } else {
                await createServerDetails(payload);
                showToast('Server details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save server details', 'error');
        }
    };

    const handleDelete = async (item: ServerDetailsData) => {
        const isConfirmed = await confirm(`Are you sure you want to delete ${item.hostName}?`, 'Delete Server Details');
        if (isConfirmed) {
            try {
                await deleteServerDetails(item.id);
                showToast('Server details deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete server details', 'error');
            }
        }
    };

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const columns: Column<ServerDetailsData>[] = [
        { id: 'slNumber', label: 'SL No', sortable: true },
        { id: 'rack', label: 'Rack', sortable: true },
        { id: 'hostName', label: 'Host Name', sortable: true },
        { id: 'ipAddress', label: 'IP Address', sortable: true },
        { id: 'serverModel', label: 'Server Model', sortable: true },
        { id: 'serialNumber', label: 'Serial Number', sortable: true },
        { 
            id: 'admin', 
            label: 'Admin', 
            sortable: true,
            render: (row) => usersMap[row.admin] || row.admin || '--'
        },
        { id: 'hypervisor', label: 'Hypervisor', sortable: true },
        { id: 'applications', label: 'Applications', sortable: true },
        { id: 'clusterType', label: 'Cluster Type', sortable: true },
        { id: 'poNum', label: 'PO Num', sortable: true },
        { id: 'assetNum', label: 'Asset Num', sortable: true }
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
                            <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {hasDelete && (
                        <Tooltip title="Delete">
                            <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        });
    }

    return (
        <Box sx={{ p: 3, width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2, flexShrink: 0 }}>
                <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Server Details</label>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search server details..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Server Details
                        </Button>
                    )}
                </Box>
            </Box>

            <Box sx={{ flexGrow: 1, width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Table
                    columns={columns}
                    data={data}
                    totalCount={totalCount}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    orderBy={orderBy}
                    order={order}
                    onSort={handleRequestSort}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    loading={loading}
                />
            </Box>

            <ServerDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default ServerDetails;
