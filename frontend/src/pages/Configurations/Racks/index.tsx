import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Tooltip, IconButton, Button as MuiButton } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdUploadFile as UploadIcon } from 'react-icons/md';
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
import { fetchServerRacks, createServerRack, updateServerRack, deleteServerRack, bulkCreateServerRacks } from './action';
import { type ServerRackData } from './model';
import ServerRackModal from './ServerRackModal';

type Order = 'asc' | 'desc';

const Racks = () => {
    const [data, setData] = useState<ServerRackData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ServerRackData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasView = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [searchQuery, setSearchQuery] = useTableState('Racks_search', '');
    const [page, setPage] = useTableState('Racks_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('Racks_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('Racks_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('Racks_orderBy', 'serverRack');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchServerRacks({
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
            showToast(e?.response?.data?.detail || 'Failed to load server racks', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: ServerRackData) => {
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
                await updateServerRack(payload);
                showToast('Server Rack updated successfully', 'success');
            } else {
                await createServerRack(payload);
                showToast('Server Rack created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save serverRack', 'error');
        }
    };

    const handleDelete = async (item: ServerRackData) => {
        const isConfirmed = await confirm(`Are you sure you want to delete ${item.serverRack}?`, 'Delete Server Rack');
        if (isConfirmed) {
            try {
                await deleteServerRack(item.id);
                showToast('Server Rack deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete serverRack', 'error');
            }
        }
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            await bulkCreateServerRacks(file);
            showToast('Bulk upload successful', 'success');
            loadData();
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            const message = typeof detail === 'string'
                ? detail
                : (Array.isArray(detail) && detail[0]?.msg)
                    ? detail[0].msg
                    : 'Bulk upload failed';
            showToast(message, 'error');
        }
        event.target.value = '';
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

    const columns: Column<ServerRackData>[] = [
        { id: 'serverRack', label: 'Server Rack Name', sortable: true },
        { 
            id: 'networksAvailable', 
            label: 'Networks Available', 
            sortable: false,
            render: (row) => {
                if (!row.networksAvailable || row.networksAvailable.length === 0) return 'None';
                return row.networksAvailable.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(', ');
            }
        },
        { 
            id: 'rackCapacity', 
            label: 'Capacity', 
            sortable: true,
            render: (row) => row.rackCapacity !== undefined && row.rackCapacity !== null ? `${row.remainingCapacity ?? row.rackCapacity} U / ${row.rackCapacity} U` : '-'
        },
        { 
            id: 'temperature', 
            label: 'Temperature', 
            sortable: true,
            render: (row) => row.temperature !== undefined && row.temperature !== null ? `${row.temperature} °C` : '-'
        },
        { 
            id: 'fanAvailable', 
            label: 'Fan Available', 
            sortable: true,
            render: (row) => row.fanAvailable ? 'Yes' : 'No'
        },
        { 
            id: 'sparePowerAvailability', 
            label: 'Spare Power', 
            sortable: true,
            render: (row) => {
                const parts: string[] = [];
                if (row.sparePowerAvailability) parts.push('Yes');
                if (row.sparePowerC30) parts.push(`C-30: ${row.sparePowerC30}`);
                if (row.sparePowerC90) parts.push(`C-90: ${row.sparePowerC90}`);
                return parts.length > 0 ? parts.join(' | ') : 'No';
            }
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

    if (!hasView) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <label style={{ color: '#ff4d4f', fontSize: '18px', fontWeight: 'bold' }}>Access Denied</label>
                <p style={{ color: '#666', marginTop: '8px' }}>You do not have privilege to view this page.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search server racks..."
                    />
                    {hasCreate && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <MuiButton
                                component="label"
                                variant="outlined"
                                color="primary"
                                startIcon={<UploadIcon />}
                                sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                            >
                                Bulk Upload
                                <input
                                    type="file"
                                    hidden
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    onChange={handleBulkUpload}
                                />
                            </MuiButton>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenModal()}
                            >
                                Add Server Rack
                            </Button>
                        </Box>
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

            <ServerRackModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default Racks;
