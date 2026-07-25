// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { Box, Tooltip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdMonitor as MonitorIcon, MdCloudDownload as CloudDownloadIcon } from 'react-icons/md';
import request from '../../../services/request';
import Button from '../../../components/Button';
import SearchBar from '../../../components/SearchBar';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { fetchVMDetails, createVMDetails, updateVMDetails, deleteVMDetails } from './action';
import { fetchClusters } from '../action';
import { useTableState } from '../../../hooks/useTableState';
import { type VMDetailsData } from './model';
import VMDetailsModal from './VMDetailsModal';
import VMHistoryModal from './VMHistoryModal';
import styles from './index.module.scss';

interface VMDetailsProps {
    clusterId?: string;
    dashboardAdminFilter?: string;
}

const VMDetails = ({ clusterId = '', dashboardAdminFilter }: VMDetailsProps) => {
    const [data, setData] = useState<VMDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<VMDetailsData | null>(null);

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistoryVm, setSelectedHistoryVm] = useState<VMDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const { users } = useSelector((state: RootState) => state.users || { users: [] });
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [clusters, setClusters] = useState<any[]>([]);
    const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('All');
    const [adminFilter, setAdminFilter] = useTableState("VMDetails_adminFilter", dashboardAdminFilter || "");
    const [monitoredIps, setMonitoredIps] = useState<Set<string>>(new Set());

    const [vcenters, setVcenters] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    useEffect(() => {
        request.get('/api/users/?pagination=false')
            .then((res) => {
                const map: Record<string, string> = {};
                const list = res.data?.data || [];
                list.forEach((u: any) => {
                    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
                    const displayName = fullName || u.username;
                    if (u._id) map[u._id] = displayName;
                    if (u.id) map[u.id] = displayName;
                    if (u.username) map[u.username] = displayName;
                });
                setUsersMap(map);
            })
            .catch((err) => console.error("Failed to load users:", err));
    }, []);

    useEffect(() => {
        request.get('/api/vcenter-details/?pagination=false')
            .then(res => setVcenters(res.data?.data || []))
            .catch(err => console.error("Failed to load vCenters", err));
    }, []);

    const handleBulkImportVcenter = async () => {
        const isConfirmed = await confirm(
            "Are you sure you want to import all VMs from registered vCenter appliances into VM Details? This will automatically add all new VMs and update status for existing VMs.",
            "Import All VMs from vCenter"
        );
        if (isConfirmed) {
            setIsImporting(true);
            try {
                const res = await request.post('/api/vm-details/import-vcenter', {}, { timeout: 60000 });
                showToast(res.data?.message || "Successfully imported VMs from vCenter", "success");
                loadData();
            } catch (err: any) {
                const detail = err?.response?.data?.detail || err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'Request timed out. The vCenter import is taking longer than expected.' : "Failed to import VMs from vCenter");
                showToast(detail, "error");
            } finally {
                setIsImporting(false);
            }
        }
    };

    const fetchMonitoredIps = useCallback(async () => {
        try {
            const res = await request.get('/api/server-ping-monitoring/', { params: { limit: 1000 } });
            const ips = new Set((res.data?.data || []).map((s: any) => s.ipAddress));
            setMonitoredIps(ips);
        } catch (err) {
            console.error("Failed to load monitored IPs:", err);
        }
    }, []);

    useEffect(() => {
        fetchMonitoredIps();
    }, [fetchMonitoredIps]);

    // Reset page when dashboard filter changes
    useEffect(() => {
        if (dashboardAdminFilter) {
            setAdminFilter(dashboardAdminFilter);
            setPage(0);
        }
    }, [dashboardAdminFilter]);


    useEffect(() => {
        if (!clusterId) {
            fetchClusters({ pagination: false })
                .then(res => setClusters(res.data || []))
                .catch(err => console.error("Failed to load clusters", err));
        }
    }, [clusterId]);

    const getClusterName = (cid: string) => {
        if (!cid) return '--';
        const found = clusters.find(c => 
            c.id === cid || 
            c._id === cid || 
            (c.vcenterClusterId && c.vcenterClusterId === cid) ||
            (c.clusterName && c.clusterName.toLowerCase() === cid.toLowerCase())
        );
        return found ? found.clusterName : cid;
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true,
                sortBy: 'vmId',
                order: 'asc'
            };
            if (clusterId) {
                params.clusterId = clusterId;
            } else if (selectedClusterFilter !== 'All') {
                params.clusterId = selectedClusterFilter;
            }
            if (adminFilter) {
                params.admin = adminFilter;
            }
            const result = await fetchVMDetails(params);
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load VM Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, selectedClusterFilter, adminFilter, page, rowsPerPage, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        loadData();
    }, [adminFilter]);

    const handleOpenModal = (item?: VMDetailsData) => {
        setEditingItem(item || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleOpenHistoryModal = (item: VMDetailsData) => {
        setSelectedHistoryVm(item);
        setIsHistoryModalOpen(true);
    };

    const handleCloseHistoryModal = () => {
        setIsHistoryModalOpen(false);
        setSelectedHistoryVm(null);
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

    const handleAddToMonitoring = async (row: VMDetailsData) => {
        if (!row.ipAddress) {
            showToast("This VM does not have an IP address configured. Edit the VM to set an IP first.", "warning");
            return;
        }
        const isConfirmed = await confirm(
            `Are you sure you want to add VM ${row.vmId || "this VM"} (${row.ipAddress}) to Ping Monitoring?`,
            "Add to Monitoring"
        );
        if (isConfirmed) {
            try {
                await request.post('/api/server-ping-monitoring/', {
                    name: row.vmId || "Unnamed VM",
                    ipAddress: row.ipAddress,
                    adminName: row.adminName || "Admin",
                    monitoringType: "ping",
                    interval: 60,
                    timeout: 5,
                    retryCount: 3,
                    ports: [],
                    isEnabled: true
                });
                setMonitoredIps(prev => {
                    const next = new Set(prev);
                    next.add(row.ipAddress);
                    return next;
                });
                showToast("VM added to ping monitoring successfully", "success");
            } catch (e: any) {
                showToast(
                    e?.response?.data?.detail || "Failed to add VM to monitoring",
                    "error"
                );
            }
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
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>VM Details</Typography>
                <Box className={styles.container__header__search} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {!clusterId && (
                        <>
                            <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#fff' }}>
                                <InputLabel>Cluster Filter</InputLabel>
                                <Select
                                    value={selectedClusterFilter}
                                    label="Cluster Filter"
                                    onChange={(e) => {
                                        setSelectedClusterFilter(e.target.value);
                                        setPage(0);
                                    }}
                                >
                                    <MenuItem value="All">All Clusters</MenuItem>
                                    {clusters.map((c: any) => (
                                        <MenuItem key={c.id || c._id} value={c.id || c._id}>{c.clusterName || c.id}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#fff' }}>
                                <InputLabel>Admin Filter</InputLabel>
                                <Select
                                    value={adminFilter}
                                    label="Admin Filter"
                                    onChange={(e) => {
                                        setAdminFilter(e.target.value);
                                        setPage(0);
                                    }}
                                >
                                    <MenuItem value="">All Admins</MenuItem>
                                    {users && users.map((u: any) => (
                                        <MenuItem key={u._id || u.id} value={u._id || u.id || u.username}>
                                            {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </>
                    )}
                    <SearchBar
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setPage(0); }}
                        placeholder="Search IP, App or Node..."
                    />
                    {isSuperuser && vcenters.length > 0 && (
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<CloudDownloadIcon />}
                            disabled={isImporting}
                            onClick={handleBulkImportVcenter}
                        >
                            {isImporting ? "Importing VMs..." : "Import All VMs from vCenter"}
                        </Button>
                    )}
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

            <Paper className={styles.tableWrapper}>
                <TableContainer>
                    <Table size="medium">
                        <TableHead>
                            <TableRow className={styles.tableWrapper__headerRow}>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>VM ID</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>VM Name</TableCell>
                                {!clusterId && (
                                    <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Cluster</TableCell>
                                )}
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>IP Address</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Applications</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Node</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>OS and Expiry</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Backup Location</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Admin Name</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Admin Contact</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Power Status</TableCell>
                                <TableCell colSpan={3} align="center" className={styles.tableWrapper__headerCell}>Resource Allotter</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Created By</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Created At</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Updated By</TableCell>
                                <TableCell rowSpan={2} className={styles.tableWrapper__headerCell}>Updated At</TableCell>
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
                                    <TableCell colSpan={clusterId ? 18 : 19} align="center" sx={{ py: 3 }}>Loading...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={clusterId ? 18 : 19} align="center" sx={{ py: 3, color: 'text.secondary' }}>No VM Details found</TableCell>
                                </TableRow>
                            ) : (
                                data.map((row) => (
                                    <TableRow 
                                        key={row.id} 
                                        hover 
                                        onClick={() => handleOpenHistoryModal(row)} 
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell className={styles.tableWrapper__cell} sx={{ fontWeight: 600, color: '#1565c0' }}>{row.vmId || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.vmName || '--'}</TableCell>
                                        {!clusterId && (
                                            <TableCell className={styles.tableWrapper__cell}>{getClusterName(row.clusterId || '')}</TableCell>
                                        )}
                                        <TableCell className={styles.tableWrapper__cell}>{row.ipAddress || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.applications || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.node || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.osAndExpiry || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.backupLocation || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.adminName || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.adminContact || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>
                                            <span style={{
                                                textTransform: 'uppercase',
                                                fontWeight: 'bold',
                                                color: (row.powerStatus || 'on') === 'on' ? '#2e7d32' : '#d32f2f'
                                            }}>
                                                {row.powerStatus || 'on'}
                                            </span>
                                        </TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.hdd || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.ram || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.cpu || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{usersMap[row.createdBy || ''] || row.createdBy || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.createdAt ? dayjs(row.createdAt).format('DD-MM-YYYY h:mm A') : '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{usersMap[row.updatedBy || ''] || row.updatedBy || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.updatedAt ? dayjs(row.updatedAt).format('DD-MM-YYYY h:mm A') : '--'}</TableCell>
                                        {(hasUpdate || hasDelete) && (
                                            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                                <Box className={styles.tableWrapper__actions}>
                                                    {row.ipAddress && monitoredIps.has(row.ipAddress) ? (
                                                        <Tooltip title="Already Monitored">
                                                            <span>
                                                                <IconButton size="small" disabled className={styles.tableWrapper__actions__editBtn} sx={{ mr: 0.5, color: '#2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.08)', '&.Mui-disabled': { color: '#2e7d32' } }}>
                                                                    <MonitorIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Add to Monitoring">
                                                            <IconButton size="small" color="info" className={styles.tableWrapper__actions__editBtn} onClick={() => handleAddToMonitoring(row)} sx={{ mr: 0.5 }}>
                                                                <MonitorIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {hasUpdate && (
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" color="primary" className={styles.tableWrapper__actions__editBtn} onClick={() => handleOpenModal(row)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {hasDelete && (
                                                        <Tooltip title="Delete">
                                                            <IconButton size="small" color="error" className={styles.tableWrapper__actions__deleteBtn} onClick={() => handleDelete(row.id || '', row.ipAddress || '')}>
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

            <VMDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />

            <VMHistoryModal
                open={isHistoryModalOpen}
                onClose={handleCloseHistoryModal}
                vm={selectedHistoryVm}
            />
        </Box>
    );
};

export default VMDetails;
