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
import { fetchPhysicalServers, createPhysicalServer, updatePhysicalServer, deletePhysicalServer } from './action';
import { fetchClusters } from '../../Clusters/action';
import { type PhysicalServerData } from './model';
import PhysicalServerModal from './PhysicalServerModal';
import styles from './index.module.scss';

interface PhysicalServersProps {
    clusterId?: string;
}

const PhysicalServers = ({ clusterId = '' }: PhysicalServersProps) => {
    const [data, setData] = useState<PhysicalServerData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PhysicalServerData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [clusters, setClusters] = useState<any[]>([]);

    useEffect(() => {
        if (!clusterId) {
            fetchClusters({ pagination: false })
                .then(res => setClusters(res.data || []))
                .catch(err => console.error("Failed to load clusters", err));
        }
    }, [clusterId]);

    const getClusterName = (cid: string) => {
        const found = clusters.find(c => c.id === cid);
        return found ? found.clusterName : cid || '--';
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true
            };
            if (clusterId) {
                params.clusterId = clusterId;
            }
            const result = await fetchPhysicalServers(params);
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load Physical Server Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, page, rowsPerPage, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: PhysicalServerData) => {
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
                await updatePhysicalServer(editingItem.id, formData);
                showToast('Physical Server Details updated successfully', 'success');
            } else {
                await createPhysicalServer(formData);
                showToast('Physical Server Details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string, ipAddress: string) => {
        const isConfirmed = await confirm(`Are you sure you want to delete Physical Server Details for ${ipAddress}? This action cannot be undone.`, 'Delete Physical Server Details');
        if (isConfirmed) {
            try {
                await deletePhysicalServer(id);
                showToast('Physical Server Details deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete Physical Server Details', 'error');
            }
        }
    };

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>Physical Server Details</Typography>
                <Box className={styles.container__header__search}>
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
                            Add Physical Server
                        </Button>
                    )}
                </Box>
            </Box>

            <Paper className={styles.tableWrapper}>
                <TableContainer>
                    <Table size="medium">
                        <TableHead>
                            <TableRow className={styles.tableWrapper__headerRow}>
                                {!clusterId && (
                                    <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Cluster</TableCell>
                                )}
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>IP Address</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Applications</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Node</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>OS and Expiry</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Backup Location</TableCell>
                                <TableCell colSpan={3} align="center" className={styles.tableWrapper__headerCell}>Resource Allotter</TableCell>
                                {(hasUpdate || hasDelete) && (
                                    <TableCell rowSpan={2} align="right" className={styles.tableWrapper__headerCellLast}>Actions</TableCell>
                                )}
                            </TableRow>
                            <TableRow className={styles.tableWrapper__headerRow}>
                                <TableCell className={styles.tableWrapper__headerCell}>HDD</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell}>RAM</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell}>CPU</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={clusterId ? 9 : 10} align="center" sx={{ py: 3 }}>Loading...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={clusterId ? 9 : 10} align="center" sx={{ py: 3, color: 'text.secondary' }}>No Physical Server Details found</TableCell>
                                </TableRow>
                            ) : (
                                data.map((row) => (
                                    <TableRow key={row.id} hover>
                                        {!clusterId && (
                                            <TableCell className={styles.tableWrapper__cell}>{getClusterName(row.clusterId)}</TableCell>
                                        )}
                                        <TableCell className={styles.tableWrapper__cell}>{row.ipAddress || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.applications || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.node || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.osAndExpiry || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.backupLocation || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.hdd || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.ram || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.cpu || '--'}</TableCell>
                                        {(hasUpdate || hasDelete) && (
                                            <TableCell align="right">
                                                <Box className={styles.tableWrapper__actions}>
                                                    {hasUpdate && (
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" color="primary" className={styles.tableWrapper__actions__editBtn} onClick={() => handleOpenModal(row)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {hasDelete && (
                                                        <Tooltip title="Delete">
                                                            <IconButton size="small" color="error" className={styles.tableWrapper__actions__deleteBtn} onClick={() => handleDelete(row.id, row.ipAddress)}>
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
                    rowsPerPageOptions={[25, 50, 100]}
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

            <PhysicalServerModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />
        </Box>
    );
};

export default PhysicalServers;
