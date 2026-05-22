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
import { fetchNodes, createNode, updateNode, deleteNode } from './action';
import { type NodeData } from './model';
import NodeModal from './NodeModal';

type Order = 'asc' | 'desc';

const Nodes = () => {
    const [data, setData] = useState<NodeData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<NodeData | null>(null);

    const { showToast } = useToast();
    const confirm = useConfirm() as any;

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_DELETE);

    const [searchQuery, setSearchQuery] = useTableState('Nodes_search', '');
    const [page, setPage] = useTableState('Nodes_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('Nodes_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('Nodes_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('Nodes_orderBy', 'node');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchNodes({
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
            showToast(e?.response?.data?.detail || 'Failed to load nodes', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: NodeData) => {
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
                await updateNode(payload);
                showToast('Node updated successfully', 'success');
            } else {
                await createNode(payload);
                showToast('Node created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save node', 'error');
        }
    };

    const handleDelete = (item: NodeData) => {
        confirm({
            title: 'Delete Node',
            description: `Are you sure you want to delete ${item.node}?`,
            onConfirm: async () => {
                try {
                    await deleteNode(item.id);
                    showToast('Node deleted successfully', 'success');
                    if (data.length === 1 && page > 0) {
                        setPage(page - 1);
                    } else {
                        loadData();
                    }
                } catch (e: any) {
                    showToast(e?.response?.data?.detail || 'Failed to delete node', 'error');
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

    const columns: Column<NodeData>[] = [
        { id: 'node', label: 'Node', sortable: true },
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
                        placeholder="Search nodes..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Node
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

            <NodeModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default Nodes;
