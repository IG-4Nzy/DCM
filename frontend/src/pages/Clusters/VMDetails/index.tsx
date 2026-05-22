import { useState, useEffect, useCallback } from 'react';
import { Box, Tooltip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Typography } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import SearchBar from '../../../components/SearchBar';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { fetchVMDetails, createVMDetails, updateVMDetails, deleteVMDetails } from './action';
import { type VMDetailsData } from './model';
import VMDetailsModal from './VMDetailsModal';

interface VMDetailsProps {
    clusterId: string;
}

const VMDetails = ({ clusterId }: VMDetailsProps) => {
    const [data, setData] = useState<VMDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<VMDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_DELETE);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchVMDetails({
                clusterId,
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load VM Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, page, rowsPerPage, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: VMDetailsData) => {
        setEditingItem(item || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingItem) {
                if (Object.keys(formData).length === 0) {
                    handleCloseModal();
                    return;
                }
                await updateVMDetails(editingItem.id, formData);
                showToast('VM Details updated successfully', 'success');
            } else {
                await createVMDetails(formData);
                showToast('VM Details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string, ipAddress: string) => {
        const isConfirmed = await confirm(`Are you sure you want to delete VM Details for ${ipAddress}? This action cannot be undone.`, 'Delete VM Details');
        if (isConfirmed) {
            try {
                await deleteVMDetails(id);
                showToast('VM Details deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete VM Details', 'error');
            }
        }
    };

    return (
        <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" fontWeight="bold">VM Details</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setPage(0); }}
                        placeholder="Search IP, App or Node..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add VM Details
                        </Button>
                    )}
                </Box>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: '12px', boxShadow: 'none' }}>
                <TableContainer>
                    <Table size="medium">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                <TableCell rowSpan={2} sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>IP Address</TableCell>
                                <TableCell rowSpan={2} sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>Applications</TableCell>
                                <TableCell rowSpan={2} sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>Node</TableCell>
                                <TableCell rowSpan={2} sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>OS and Expiry</TableCell>
                                <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>Resource Allotter</TableCell>
                                {(hasUpdate || hasDelete) && (
                                    <TableCell rowSpan={2} align="right" sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0' }}>Actions</TableCell>
                                )}
                            </TableRow>
                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>HDD</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>RAM</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>CPU</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>Loading...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>No VM Details found</TableCell>
                                </TableRow>
                            ) : (
                                data.map((row) => (
                                    <TableRow key={row.id} hover>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.ipAddress || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.applications || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.node || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.osAndExpiry || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.hdd || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.ram || '--'}</TableCell>
                                        <TableCell sx={{ borderRight: '1px solid #eee' }}>{row.cpu || '--'}</TableCell>
                                        {(hasUpdate || hasDelete) && (
                                            <TableCell align="right">
                                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                    {hasUpdate && (
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" color="primary" sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }} onClick={() => handleOpenModal(row)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {hasDelete && (
                                                        <Tooltip title="Delete">
                                                            <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={() => handleDelete(row.id, row.ipAddress)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={totalCount}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Paper>

            <VMDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />
        </Box>
    );
};

export default VMDetails;
