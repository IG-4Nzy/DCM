// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { Box, Tooltip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdMonitor as MonitorIcon, MdCloudDownload as CloudDownloadIcon, MdFilterList as FilterListIcon, MdPowerSettingsNew as PowerIcon, MdWifi as NetworkOnIcon, MdWifiOff as NetworkOffIcon, MdWarning as WarningIcon, MdCameraAlt as SnapshotIcon } from 'react-icons/md';
import { FilterDrawer, FilterGroup } from '../../../components/FilterDrawer';
import Dropdown from '../../../components/Dropdown';
import request from '../../../services/request';
import Button from '../../../components/Button';
import SearchBar from '../../../components/SearchBar';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { fetchVMDetails, createVMDetails, updateVMDetails, deleteVMDetails, fetchAllNodes } from './action';
import { fetchClusters } from '../action';
import { useTableState } from '../../../hooks/useTableState';
import { type VMDetailsData } from './model';
import VMDetailsModal from './VMDetailsModal';
import VMHistoryModal from './VMHistoryModal';
import { Icons } from '../../../helpers/icons';
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

    const { isSuperuser, username } = useSelector((state: RootState) => state.auth);
    const { users } = useSelector((state: RootState) => state.users || { users: [] });
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [clusters, setClusters] = useState<any[]>([]);
    const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('All');
    const [adminFilter, setAdminFilter] = useTableState("VMDetails_adminFilter", dashboardAdminFilter || "");
    const [nodeFilter, setNodeFilter] = useTableState("VMDetails_nodeFilter", "");
    const [powerStatusFilter, setPowerStatusFilter] = useTableState("VMDetails_powerStatusFilter", "");
    const [networkTypeFilter, setNetworkTypeFilter] = useTableState("VMDetails_networkTypeFilter", "");
    const [clusterTypeFilter, setClusterTypeFilter] = useTableState("VMDetails_clusterTypeFilter", "");
    const [clusterTypesList, setClusterTypesList] = useState<string[]>([]);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [nodesList, setNodesList] = useState<any[]>([]);
    const [monitoredIps, setMonitoredIps] = useState<Set<string>>(new Set());

    const [vcenters, setVcenters] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [allUsers, setAllUsers] = useState<any[]>([]);

    useEffect(() => {
        request.get('/api/users/?pagination=false')
            .then((res) => {
                const map: Record<string, string> = {};
                const list = res.data?.data || [];
                setAllUsers(list);
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
        fetchAllNodes()
            .then(nodes => setNodesList(nodes || []))
            .catch(err => console.error("Failed to load nodes", err));

        request.get('/api/cluster-types/', { params: { pagination: false } })
            .then((res) => {
                const types = (res.data?.data || []).map((t: any) => t.clusterType).filter(Boolean).sort();
                setClusterTypesList(types);
            })
            .catch((err) => console.error("Failed to load cluster types:", err));
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
            if (nodeFilter) {
                params.node = nodeFilter;
            }
            if (powerStatusFilter) {
                params.powerStatus = powerStatusFilter;
            }
            if (networkTypeFilter) {
                params.networkType = networkTypeFilter;
            }
            if (clusterTypeFilter) {
                params.clusterType = clusterTypeFilter;
            }
            const result = await fetchVMDetails(params);
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load VM Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, selectedClusterFilter, adminFilter, nodeFilter, powerStatusFilter, networkTypeFilter, clusterTypeFilter, page, rowsPerPage, searchQuery, showToast]);

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

    const hasViewAll = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const currentUser = allUsers.find(u => u.username === username);
    const userDept = currentUser?.department;

    const filteredAdmins = allUsers
        .filter(u => {
            if (hasViewAll) return true;
            return u.department === userDept;
        })
        .map(u => ({
            label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
            value: u._id || u.id || u.username
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const adminOptions = hasViewAll
        ? [
            { label: 'All Admins', value: '' },
            { label: 'Unassigned', value: 'unassigned' },
            { label: 'Other', value: 'other' },
            ...filteredAdmins
        ]
        : [
            { label: 'Unassigned', value: 'unassigned' },
            ...filteredAdmins
        ];

    const activeFilterCount = [
        (!clusterId && selectedClusterFilter !== 'All') ? selectedClusterFilter : '',
        adminFilter,
        nodeFilter,
        powerStatusFilter,
        networkTypeFilter,
        clusterTypeFilter
    ].filter(Boolean).length;

    const handleClearAllFilters = () => {
        setSelectedClusterFilter('All');
        setAdminFilter('');
        setNodeFilter('');
        setPowerStatusFilter('');
        setNetworkTypeFilter('');
        setClusterTypeFilter('');
        setPage(0);
    };

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>VM Details</Typography>
                <Box className={styles.container__header__search} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setPage(0); }}
                        placeholder="Search VM Name, IP, App or Node..."
                    />
                    <Button
                        variant={activeFilterCount > 0 ? "contained" : "outlined"}
                        color="primary"
                        startIcon={<FilterListIcon size={20} />}
                        onClick={() => setIsFilterDrawerOpen(true)}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                    >
                        Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                    </Button>
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

            {/* Right Sidebar Filter Popup */}
            <FilterDrawer
                open={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                onClearAll={handleClearAllFilters}
                title="VM Filters"
                activeCount={activeFilterCount}
            >
                <FilterGroup title="Cluster & Host Node">
                    {!clusterId && (
                        <Dropdown
                            label="Cluster Filter"
                            size="small"
                            searchable
                            clearable
                            value={selectedClusterFilter}
                            onChange={(val) => {
                                setSelectedClusterFilter(val || 'All');
                                setPage(0);
                            }}
                            options={[
                                { label: 'All Clusters', value: 'All' },
                                ...clusters.map((c: any) => ({ label: c.clusterName || c.id, value: c.id || c._id }))
                            ]}
                        />
                    )}
                    <Dropdown
                        label="Host Node"
                        size="small"
                        searchable
                        clearable
                        value={nodeFilter}
                        onChange={(val) => {
                            setNodeFilter(val);
                            setPage(0);
                        }}
                        options={[
                            { label: 'All Host Nodes', value: '' },
                            ...nodesList.map((n: any) => {
                                const nodeName = n.node || n.hostName || n.nodeId || n.name || '';
                                const ip = n.ip || n.ipAddress || n.managementIp || '';
                                const label = ip ? `${nodeName} - ${ip}` : nodeName;
                                const val = n.node || n.hostName || n.nodeId || n.name || '';
                                return { label, value: val };
                            })
                        ]}
                    />
                    <Dropdown
                        label="Cluster Type"
                        size="small"
                        searchable
                        clearable
                        value={clusterTypeFilter}
                        onChange={(val) => {
                            setClusterTypeFilter(val);
                            setPage(0);
                        }}
                        options={[
                            { label: 'All Cluster Types', value: '' },
                            ...clusterTypesList.map((ct) => ({ label: ct, value: ct }))
                        ]}
                    />
                    <Dropdown
                        label="Network Type"
                        size="small"
                        clearable
                        value={networkTypeFilter}
                        onChange={(val) => {
                            setNetworkTypeFilter(val);
                            setPage(0);
                        }}
                        options={[
                            { label: 'All Networks', value: '' },
                            { label: 'Intranet', value: 'intranet' },
                            { label: 'Internet', value: 'internet' },
                            { label: 'Disconnected', value: 'disconnected' }
                        ]}
                    />
                </FilterGroup>

                <FilterGroup title="Management & Status">
                    {!clusterId && (
                        <Dropdown
                            label="Admin Filter"
                            size="small"
                            searchable
                            clearable
                            value={adminFilter}
                            onChange={(val) => {
                                setAdminFilter(val);
                                setPage(0);
                            }}
                            options={adminOptions}
                        />
                    )}

                    <Dropdown
                        label="Power Status"
                        size="small"
                        searchable
                        clearable
                        value={powerStatusFilter}
                        onChange={(val) => {
                            setPowerStatusFilter(val);
                            setPage(0);
                        }}
                        options={[
                            { label: 'All Statuses', value: '' },
                            { label: 'ON', value: 'on' },
                            { label: 'OFF', value: 'off' }
                        ]}
                    />
                </FilterGroup>
            </FilterDrawer>

            <Paper className={styles.tableWrapper}>
                <TableContainer sx={{ flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: 'auto' }}>
                    <Table size="medium" stickyHeader>
                        <TableHead>
                            <TableRow className={styles.tableWrapper__headerRow}>
                                <TableCell className={styles.tableWrapper__headerCell}>VM ID</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell}>VM Name</TableCell>
                                {!clusterId && (
                                    <TableCell className={styles.tableWrapper__headerCell}>Cluster</TableCell>
                                )}
                                <TableCell className={styles.tableWrapper__headerCell}>IP Address</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell}>Node</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell}>Admin</TableCell>
                                {(hasUpdate || hasDelete) && (
                                    <TableCell align="right" className={styles.tableWrapper__headerCellLast}>Actions</TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={clusterId ? 6 : 7} align="center" sx={{ py: 3 }}>Loading...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={clusterId ? 6 : 7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No VM Details found</TableCell>
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
                                        <TableCell className={styles.tableWrapper__cell}>
                                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'nowrap' }}>
                                                 <Typography variant="body2" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                                                     {row.vmName || '--'}
                                                 </Typography>
                                                 <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                                                     {/* Power Status Indicator */}
                                                     {(() => {
                                                         const pStatus = (row.powerStatus || '').toLowerCase();
                                                         const isPowerOn = pStatus === 'on' || pStatus === 'poweredon' || pStatus === 'running';
                                                         return (
                                                             <Tooltip title={`Power Status: ${isPowerOn ? 'ON' : 'OFF'}`} arrow placement="top">
                                                                 <Box sx={{ 
                                                                     display: 'inline-flex', 
                                                                     alignItems: 'center', 
                                                                     gap: 0.3,
                                                                     px: 0.8, 
                                                                     py: 0.25, 
                                                                     borderRadius: '10px',
                                                                     fontSize: '11px',
                                                                     fontWeight: 700,
                                                                     letterSpacing: '0.3px',
                                                                     color: isPowerOn ? '#1b5e20' : '#c62828',
                                                                     backgroundColor: isPowerOn ? 'rgba(46, 125, 50, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                                                                     border: `1px solid ${isPowerOn ? '#a5d6a7' : '#ef9a9a'}`,
                                                                     lineHeight: 1
                                                                 }}>
                                                                     <PowerIcon style={{ fontSize: '13px', color: isPowerOn ? '#2e7d32' : '#d32f2f' }} />
                                                                     <span>{isPowerOn ? 'ON' : 'OFF'}</span>
                                                                 </Box>
                                                             </Tooltip>
                                                         );
                                                     })()}

                                                     {/* Network Connection Indicator */}
                                                     {(() => {
                                                         const isNetworkConnected = row.isNetworkConnected !== false;
                                                         return (
                                                             <Tooltip title={`Network: ${isNetworkConnected ? 'Connected' : 'Disconnected'}`} arrow placement="top">
                                                                 <Box sx={{ 
                                                                     display: 'inline-flex', 
                                                                     alignItems: 'center', 
                                                                     justifyContent: 'center', 
                                                                     p: '4px',
                                                                     borderRadius: '50%',
                                                                     color: isNetworkConnected ? '#0288d1' : '#d32f2f',
                                                                     backgroundColor: isNetworkConnected ? 'rgba(2, 136, 209, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                                                                     border: `1px solid ${isNetworkConnected ? '#81d4fa' : '#ef9a9a'}`,
                                                                     lineHeight: 1
                                                                 }}>
                                                                     {isNetworkConnected ? (
                                                                         <NetworkOnIcon style={{ fontSize: '13px' }} />
                                                                     ) : (
                                                                         <NetworkOffIcon style={{ fontSize: '13px' }} />
                                                                     )}
                                                                 </Box>
                                                             </Tooltip>
                                                         );
                                                     })()}

                                                     {/* Snapshot Indicator & Warning */}
                                                     {(() => {
                                                         const snaps = row.snapshots || [];
                                                         if (snaps.length === 0) return null;
                                                         const isMultiple = snaps.length > 1;
                                                         const snapNames = snaps.map((s: any) => s.name || s.snapshotName || 'Snapshot').join(', ');
                                                         const tooltipTitle = isMultiple 
                                                             ? `WARNING: ${snaps.length} Snapshots exist for this VM!\nSnapshots: ${snapNames}` 
                                                             : `Snapshot: ${snapNames}`;

                                                         return (
                                                             <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tooltipTitle}</span>} arrow placement="top">
                                                                 <Box sx={{ 
                                                                     display: 'inline-flex', 
                                                                     alignItems: 'center', 
                                                                     gap: 0.3,
                                                                     px: 0.8, 
                                                                     py: 0.25, 
                                                                     borderRadius: '10px',
                                                                     fontSize: '11px',
                                                                     fontWeight: 700,
                                                                     color: isMultiple ? '#d48806' : '#0284c7',
                                                                     backgroundColor: isMultiple ? '#fffbe6' : 'rgba(2, 132, 199, 0.1)',
                                                                     border: `1px solid ${isMultiple ? '#ffe58f' : '#7dd3fc'}`,
                                                                     lineHeight: 1
                                                                 }}>
                                                                     {isMultiple ? (
                                                                         <WarningIcon style={{ fontSize: '13px', color: '#d48806' }} />
                                                                     ) : (
                                                                         <SnapshotIcon style={{ fontSize: '12px', color: '#0284c7' }} />
                                                                     )}
                                                                     <span>{snaps.length} {snaps.length === 1 ? 'Snap' : 'Snaps'}</span>
                                                                 </Box>
                                                             </Tooltip>
                                                         );
                                                     })()}
                                                 </Box>
                                             </Box>
                                         </TableCell>
                                        {!clusterId && (
                                            <TableCell className={styles.tableWrapper__cell}>
                                                {(() => {
                                                    const cid = row.clusterId || '';
                                                    if (!cid) return '--';
                                                    const found = clusters.find(c => 
                                                        c.id === cid || 
                                                        c._id === cid || 
                                                        (c.vcenterClusterId && c.vcenterClusterId === cid) ||
                                                        (c.clusterName && c.clusterName.toLowerCase() === cid.toLowerCase())
                                                    );
                                                    const cName = found ? found.clusterName : cid;
                                                    const cTypeStr = `${found?.clusterType || ''} ${found?.clusterName || ''} ${cid}`.toLowerCase();
                                                    
                                                    let icon = null;
                                                    if (cTypeStr.includes('proxmox') || cTypeStr.includes('pve') || cTypeStr.includes('kvm')) {
                                                        icon = (
                                                            <Tooltip title="Proxmox" arrow placement="top">
                                                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                                    <Icons.ProxmoxIcon style={{ color: '#e64a19', fontSize: '22px', flexShrink: 0 }} />
                                                                </span>
                                                            </Tooltip>
                                                        );
                                                    } else {
                                                        icon = (
                                                            <Tooltip title="VMware" arrow placement="top">
                                                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                                    <Icons.VmwareIcon style={{ color: '#607d8b', fontSize: '22px', flexShrink: 0 }} />
                                                                </span>
                                                            </Tooltip>
                                                        );
                                                    }

                                                    return (
                                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                                            {icon}
                                                            <span>{cName}</span>
                                                        </Box>
                                                    );
                                                })()}
                                            </TableCell>
                                        )}
                                        <TableCell className={styles.tableWrapper__cell}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                                                <span>{row.ipAddress || '--'}</span>
                                                {(() => {
                                                    const isInternet = row.networkType ? row.networkType.toLowerCase() === 'internet' : row.ipAddress?.startsWith('192.168');
                                                    const isIntranet = row.networkType ? row.networkType.toLowerCase() === 'intranet' : row.ipAddress?.startsWith('10.');
                                                    if (!isInternet && !isIntranet) return null;
                                                    return (
                                                        <Box 
                                                            sx={{ 
                                                                fontSize: '10px', 
                                                                px: 0.8,
                                                                py: 0.2, 
                                                                borderRadius: '4px',
                                                                fontWeight: 700,
                                                                lineHeight: 1,
                                                                bgcolor: isInternet ? 'rgba(3, 105, 161, 0.1)' : 'rgba(21, 128, 61, 0.1)',
                                                                color: isInternet ? '#0369a1' : '#15803d',
                                                                border: `1px solid ${isInternet ? '#bae6fd' : '#bbf7d0'}`
                                                            }}
                                                        >
                                                            {isInternet ? 'Internet' : 'Intranet'}
                                                        </Box>
                                                    );
                                                })()}
                                            </Box>
                                        </TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>
                                            {(() => {
                                                if (!row.node) return '--';
                                                const foundNode = nodesList.find(n => 
                                                    n.node === row.node || 
                                                    n.hostName === row.node || 
                                                    n.nodeId === row.node || 
                                                    n.id === row.node || 
                                                    n._id === row.node
                                                );
                                                const nodeIp = foundNode?.ip || foundNode?.ipAddress || foundNode?.managementIp || '';
                                                return nodeIp ? `${row.node} - ${nodeIp}` : row.node;
                                            })()}
                                        </TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.adminName || '--'}</TableCell>
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
                    sx={{ flexShrink: 0, borderTop: '1px solid #e0e0e0', backgroundColor: '#fff' }}
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
