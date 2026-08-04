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
import { fetchDatastores, createDatastore, updateDatastore, deleteDatastore } from './action';
import { type DatastoreData } from './model';
import DatastoreModal from './DatastoreModal';

type Order = 'asc' | 'desc';

const Datastores = () => {
    const [data, setData] = useState<DatastoreData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DatastoreData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_CREATE) || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE) || hasPrivilege(PRIVILEGES.SERVER_DETAILS_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_DELETE) || hasPrivilege(PRIVILEGES.SERVER_DETAILS_DELETE);

    const [searchQuery, setSearchQuery] = useTableState('Datastores_search', '');
    const [page, setPage] = useTableState('Datastores_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('Datastores_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('Datastores_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('Datastores_orderBy', 'name');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchDatastores({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                search: searchQuery,
                pagination: true
            });
            setData(result.data || []);
            setTotalCount(result.total || 0);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load datastores', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: DatastoreData) => {
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
                await updateDatastore(editingItem.id || editingItem._id, payload);
                showToast('Datastore updated successfully', 'success');
            } else {
                await createDatastore(payload);
                showToast('Datastore created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save datastore', 'error');
        }
    };

    const handleDelete = async (item: DatastoreData) => {
        const itemId = item.id || item._id;
        const isConfirmed = await confirm(`Are you sure you want to delete ${item.name}?`, 'Delete Datastore');
        if (isConfirmed) {
            try {
                await deleteDatastore(itemId);
                showToast('Datastore deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete datastore', 'error');
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

    const columns: Column<DatastoreData>[] = [
        {
            id: 'name',
            label: 'Datastore Name',
            sortable: true,
            render: (row) => <strong>{row.name}</strong>
        },
        {
            id: 'type',
            label: 'Type',
            sortable: true,
            render: (row) => (
                <Chip
                    label={row.type || 'Local Host'}
                    size="small"
                    color={row.type === 'Local Host' ? 'primary' : row.type === 'NAS' || row.type === 'SAN' ? 'secondary' : 'default'}
                    variant="outlined"
                />
            )
        },
        {
            id: 'node',
            label: 'Node (if Local Host)',
            sortable: true,
            render: (row) => row.node ? row.node : <span style={{ color: '#888', italic: true }}>--</span>
        },
        {
            id: 'mountPath',
            label: 'Mount Path',
            sortable: true,
            render: (row) => row.mountPath ? <code>{row.mountPath}</code> : <span style={{ color: '#888' }}>--</span>
        },
        {
            id: 'capacity',
            label: 'Capacity',
            sortable: true,
            render: (row) => row.capacity ? row.capacity : <span style={{ color: '#888' }}>--</span>
        },
        {
            id: 'remarks',
            label: 'Remarks',
            sortable: false,
            render: (row) => row.remarks || '--'
        }
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
                        placeholder="Search Datastores..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Datastore
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

            <DatastoreModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default Datastores;
