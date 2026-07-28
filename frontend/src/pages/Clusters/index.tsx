// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import request from '../../services/request';
import { useNavigate } from 'react-router-dom';
import { Box, Tooltip, IconButton, Button as MuiButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdUploadFile as UploadIcon, MdFilterList as FilterListIcon } from 'react-icons/md';
import { FilterDrawer, FilterGroup } from '../../components/FilterDrawer';
import Dropdown from '../../components/Dropdown';
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
import { fetchClusters, createCluster, updateCluster, deleteCluster, bulkCreateClusters } from './action';
import { type ClusterData } from './model';
import ClusterModal from './ClusterCreate/ClusterModal';
import { Icons } from '../../helpers/icons';
import styles from './index.module.scss';

type Order = 'asc' | 'desc';

const Clusters = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<ClusterData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ClusterData | null>(null);
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

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [searchQuery, setSearchQuery] = useTableState('cluster_search', '');
    const [clusterTypeFilter, setClusterTypeFilter] = useTableState('cluster_typeFilter', '');
    const [clusterTypesList, setClusterTypesList] = useState<string[]>([]);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [page, setPage] = useTableState('cluster_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('cluster_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('cluster_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('cluster_orderBy', 'slNumber');

    useEffect(() => {
        request.get('/api/cluster-types/', { params: { pagination: false } })
            .then((res) => {
                const types = (res.data?.data || []).map((t: any) => t.clusterType).filter(Boolean).sort();
                setClusterTypesList(types);
            })
            .catch((err) => console.error("Failed to load cluster types:", err));
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchClusters({
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                search: searchQuery,
                clusterType: clusterTypeFilter || undefined,
                pagination: true
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load clusters', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, orderBy, order, searchQuery, clusterTypeFilter, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: ClusterData) => {
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
                await updateCluster(editingItem.id, formData);
                showToast('Cluster updated successfully', 'success');
            } else {
                await createCluster(formData);
                showToast('Cluster created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm('Are you sure you want to delete this Cluster? This action cannot be undone.', 'Delete Cluster');
        if (isConfirmed) {
            try {
                await deleteCluster(id);
                showToast('Cluster deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete Cluster', 'error');
            }
        }
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            await bulkCreateClusters(file);
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
        // reset input
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

    const columns: Column<ClusterData>[] = [
        { id: 'slNumber', label: 'SL No', sortable: true },
        { 
            id: 'clusterName', 
            label: 'Cluster Name', 
            sortable: true,
            render: (row) => {
                const cTypeStr = `${row.clusterType || ''} ${row.clusterName || ''}`.toLowerCase();
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
                        <span>{row.clusterName || '--'}</span>
                    </Box>
                );
            }
        },
        { id: 'clusterType', label: 'Cluster Type', sortable: true, render: (row) => row.clusterType || '--' },
        { id: 'ipAddress', label: 'IP Address', sortable: true },
        {
            id: 'racks',
            label: 'Racks Assigned',
            sortable: false,
            render: (row) => row.racks && row.racks.length > 0 ? row.racks.join(', ') : '--'
        },
        {
            id: 'nodes',
            label: 'Nodes',
            sortable: false,
            render: (row) => row.nodeNames && row.nodeNames.length > 0 ? row.nodeNames.join(', ') : '--'
        },
        { id: 'remarks', label: 'Remarks', sortable: false, render: (row) => row.remarks || '--' }
    ];

    if (isSuperuser) {
        columns.push(
            {
                id: 'createdBy',
                label: 'Created By',
                sortable: true,
                render: (row) => usersMap[row.createdBy || ''] || row.createdBy || '--'
            },
            {
                id: 'createdAt',
                label: 'Created At',
                sortable: true,
                render: (row) => row.createdAt ? dayjs(row.createdAt).format('DD-MM-YYYY h:mm A') : '--'
            },
            {
                id: 'updatedBy',
                label: 'Updated By',
                sortable: true,
                render: (row) => usersMap[row.updatedBy || ''] || row.updatedBy || '--'
            },
            {
                id: 'updatedAt',
                label: 'Updated At',
                sortable: true,
                render: (row) => row.updatedAt ? dayjs(row.updatedAt).format('DD-MM-YYYY h:mm A') : '--'
            }
        );
    }

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
                            <IconButton size="small" color="error" sx={{ backgroundColor: 'rgba(211, 47, 47, 0.04)' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        });
    }

    const activeFilterCount = clusterTypeFilter ? 1 : 0;

    const handleClearAllFilters = () => {
        setClusterTypeFilter('');
        setPage(0);
    };

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <label className={styles.container__header__label}>Clusters</label>
                <Box className={styles.container__header__search} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search Clusters..."
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
                    {isSuperuser && (
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<UploadIcon />}
                            onClick={() => setIsBulkUploadModalOpen(true)}
                        >
                            Bulk Add
                        </Button>
                    )}
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Cluster
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Right Sidebar Filter Popup */}
            <FilterDrawer
                open={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                onClearAll={handleClearAllFilters}
                title="Cluster Filters"
                activeCount={activeFilterCount}
            >
                <FilterGroup title="Classification">
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
                            { label: 'All Types', value: '' },
                            ...clusterTypesList.map((t) => ({ label: t, value: t }))
                        ]}
                    />
                </FilterGroup>
            </FilterDrawer>

            <Box sx={{ flexGrow: 1, width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Table
                    columns={columns}
                    data={data}
                    totalCount={totalCount}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    orderBy={orderBy}
                    order={order}
                    onRequestSort={handleRequestSort}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    onRowClick={(row) => {
                        localStorage.setItem('Nodes_clusterFilter', JSON.stringify(row.id));
                        window.dispatchEvent(new CustomEvent('changeServerDetailsTab', { detail: 'nodes' }));
                    }}
                />
            </Box>

            <ClusterModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />
        </Box>
    );
};

export default Clusters;