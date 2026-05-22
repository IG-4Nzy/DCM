import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tooltip, IconButton } from '@mui/material';
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
import { fetchServerModels, createServerModel, updateServerModel, deleteServerModel } from './action';
import { type ServerModelData } from './model';
import ServerModelModal from './ServerModelModal';

type Order = 'asc' | 'desc';

const ServerModels = () => {
    const [data, setData] = useState<ServerModelData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ServerModelData | null>(null);

    const { showToast } = useToast();
    const confirm = useConfirm() as any;

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_DELETE);

    const [searchQuery, setSearchQuery] = useTableState('ServerModels_search', '');
    const [page, setPage] = useTableState('ServerModels_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('ServerModels_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('ServerModels_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('ServerModels_orderBy', 'serverModel');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchServerModels({
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
            showToast(e?.response?.data?.detail || 'Failed to load server models', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: ServerModelData) => {
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
                await updateServerModel(payload);
                showToast('Server Model updated successfully', 'success');
            } else {
                await createServerModel(payload);
                showToast('Server Model created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save serverModel', 'error');
        }
    };

    const handleDelete = (item: ServerModelData) => {
        confirm({
            title: 'Delete Server Model',
            description: `Are you sure you want to delete ${item.serverModel}?`,
            onConfirm: async () => {
                try {
                    await deleteServerModel(item.id);
                    showToast('Server Model deleted successfully', 'success');
                    if (data.length === 1 && page > 0) {
                        setPage(page - 1);
                    } else {
                        loadData();
                    }
                } catch (e: any) {
                    showToast(e?.response?.data?.detail || 'Failed to delete serverModel', 'error');
                }
            }
        });
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

    const columns: Column<ServerModelData>[] = [
        { id: 'serverModel', label: 'Server Model', sortable: true },
        { id: 'remarks', label: 'Remarks', sortable: false }
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
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search server models..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Server Model
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
                    onSort={handleRequestSort}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    loading={loading}
                />
            </Paper>

            <ServerModelModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default ServerModels;
