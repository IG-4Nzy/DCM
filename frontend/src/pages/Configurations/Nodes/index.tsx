// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
import { fetchClusters } from '../../Clusters/action';
import { type NodeData } from './model';
import NodeModal from './NodeModal';
import NodeViewModal from './NodeViewModal';

type Order = 'asc' | 'desc';

const Nodes = () => {
    const [data, setData] = useState<NodeData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [clusters, setClusters] = useState<any[]>([]);

    useEffect(() => {
        fetchClusters({ pagination: false })
            .then(res => setClusters(res.data || []))
            .catch(err => console.error("Failed to load clusters", err));
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<NodeData | null>(null);

    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedViewItem, setSelectedViewItem] = useState<NodeData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [searchQuery, setSearchQuery] = useTableState('Nodes_search', '');
    const [clusterFilter, setClusterFilter] = useTableState('Nodes_clusterFilter', '');
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
                clusterId: clusterFilter || undefined,
                pagination: true
            });
            setData(result.data);
            setTotalCount(result.total);

            // Refresh detailed view data if open
            if (isViewOpen && selectedViewItem) {
                const updated = result.data.find(n => n.id === selectedViewItem.id);
                if (updated) setSelectedViewItem(updated);
            }
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load nodes', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, clusterFilter, showToast, isViewOpen, selectedViewItem]);

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

    const handleRowClick = (item: NodeData) => {
        setSelectedViewItem(item);
        setIsViewOpen(true);
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

    const handleDelete = async (item: NodeData) => {
        const isConfirmed = await confirm(`Are you sure you want to delete ${item.node}?`, 'Delete Node');
        if (isConfirmed) {
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

    const getClusterName = (cid?: string) => {
        if (!cid) return '-';
        const found = clusters.find(c => c.id === cid);
        return found ? found.clusterName : cid;
    };

    const columns: Column<NodeData>[] = [
        { id: 'nodeId', label: 'Node ID', sortable: true, render: (row) => <span style={{ fontWeight: 600, color: '#1565c0' }}>{row.nodeId || '--'}</span> },
        { 
            id: 'clusterId', 
            label: 'Cluster', 
            sortable: true,
            render: (row) => getClusterName(row.clusterId || '')
        },
        { id: 'node', label: 'Node', sortable: true },
        { id: 'serverModel', label: 'Server Model', sortable: true, render: (row) => row.serverModel || '-' },
        { id: 'serialNumber', label: 'Serial Number', sortable: true, render: (row) => row.serialNumber || '-' },
        { id: 'assetNumber', label: 'Asset Number', sortable: true, render: (row) => row.assetNumber || '-' },
        { id: 'custodian', label: 'Custodian', sortable: true, render: (row) => row.custodian || '-' },
        { 
            id: 'totalRam', 
            label: 'Total RAM', 
            sortable: true,
            render: (row) => row.totalRam !== undefined && row.totalRam !== null ? row.totalRam : '-'
        },
        { 
            id: 'totalHardisk', 
            label: 'Total HDD', 
            sortable: true,
            render: (row) => row.totalHardisk !== undefined && row.totalHardisk !== null ? row.totalHardisk : '-'
        },
        { 
            id: 'totalCpu', 
            label: 'Total CPU', 
            sortable: true,
            render: (row) => row.totalCpu !== undefined && row.totalCpu !== null ? row.totalCpu : '-'
        },
        { 
            id: 'rack', 
            label: 'Rack', 
            sortable: true,
            render: (row) => row.rack || '-'
        },
        { 
            id: 'rackPosition', 
            label: 'Position', 
            sortable: true,
            render: (row) => row.rackPosition || '-'
        },
        { 
            id: 'rackUnits', 
            label: 'Units', 
            sortable: true,
            render: (row) => row.rackUnits !== undefined && row.rackUnits !== null ? `${row.rackUnits} U` : '-'
        },
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
                    <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                        <InputLabel>Filter by Cluster</InputLabel>
                        <Select
                            value={clusterFilter}
                            label="Filter by Cluster"
                            onChange={(e) => { setClusterFilter(e.target.value); setPage(0); }}
                        >
                            <MenuItem value="">All Clusters</MenuItem>
                            {clusters.map(c => (
                                <MenuItem key={c.id} value={c.id}>{c.clusterName}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
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
                    onRowClick={handleRowClick}
                />
            </Paper>

            <NodeModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />

            <NodeViewModal
                open={isViewOpen}
                onClose={() => setIsViewOpen(false)}
                node={selectedViewItem}
            />
        </Box>
    );
};

export default Nodes;
