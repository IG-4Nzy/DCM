// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Box, Tooltip, IconButton, Typography, Button as MuiButton } from '@mui/material';
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
import { fetchNodeDetails, createNodeDetails, updateNodeDetails, deleteNodeDetails, bulkCreateNodeDetails } from './action';
import request from '../../../services/request';
import { type NodeDetailsData } from './model';
import NodeDetailsModal from './NodeDetailsModal';
import NodeDetailsViewModal from './NodeDetailsViewModal';
import styles from './index.module.scss';

type Order = 'asc' | 'desc';

interface NodeDetailsProps {
    clusterId: string;
}

const NodeDetails = ({ clusterId }: NodeDetailsProps) => {
    const [data, setData] = useState<NodeDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<NodeDetailsData | null>(null);

    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedViewItem, setSelectedViewItem] = useState<NodeDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [searchQuery, setSearchQuery] = useTableState(`nodeDetails_${clusterId}_search`, '');
    const [page, setPage] = useTableState(`nodeDetails_${clusterId}_page`, 0);
    const [rowsPerPage, setRowsPerPage] = useTableState(`nodeDetails_${clusterId}_rowsPerPage`, 5);
    const [order, setOrder] = useTableState<Order>(`nodeDetails_${clusterId}_order`, 'asc');
    const [orderBy, setOrderBy] = useTableState<string>(`nodeDetails_${clusterId}_orderBy`, 'slNumber');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchNodeDetails({
                clusterId,
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                sortBy: orderBy,
                order,
                search: searchQuery,
                pagination: true
            });
            setData(result.data);
            setTotalCount(result.total);

            if (isViewOpen && selectedViewItem) {
                const updated = result.data.find(n => n.id === selectedViewItem.id);
                if (updated) setSelectedViewItem(updated);
            }
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load node details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, page, rowsPerPage, orderBy, order, searchQuery, showToast, isViewOpen, selectedViewItem]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        request.get('/api/users/', { params: { pagination: false } }).then(res => {
            const map: Record<string, string> = {};
            res.data.data.forEach((u: any) => {
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                const displayName = fullName || u.username;
                if (u._id) map[u._id] = displayName;
                if (u.id) map[u.id] = displayName;
                if (u.username) map[u.username] = displayName;
            });
            setUsersMap(map);
        }).catch(err => console.error("Failed to load users:", err));
    }, []);

    const handleOpenModal = (item?: NodeDetailsData) => {
        setEditingItem(item || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleRowClick = (item: NodeDetailsData) => {
        setSelectedViewItem(item);
        setIsViewOpen(true);
    };

    const handleSubmit = async (payload: any) => {
        try {
            if (editingItem) {
                await updateNodeDetails(payload);
                showToast('Node details updated successfully', 'success');
            } else {
                await createNodeDetails(payload);
                showToast('Node details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to save node details', 'error');
        }
    };

    const handleDelete = async (item: NodeDetailsData) => {
        const isConfirmed = await confirm(`Are you sure you want to delete ${item.hostName}?`, 'Delete Node Details');
        if (isConfirmed) {
            try {
                await deleteNodeDetails(item.id);
                showToast('Node details deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete node details', 'error');
            }
        }
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            await bulkCreateNodeDetails(clusterId, file);
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

    const columns: Column<NodeDetailsData>[] = [
        { id: 'nodeId', label: 'Node ID', sortable: true, render: (row) => <span style={{ fontWeight: 600, color: '#1565c0' }}>{row.nodeId || '--'}</span> },
        { id: 'slNumber', label: 'SL No', sortable: true },
        { id: 'rack', label: 'Rack', sortable: true },
        { id: 'hostName', label: 'Host Name', sortable: true },
        { id: 'ipAddress', label: 'IP Address', sortable: true },
        { 
            id: 'totalRam', 
            label: 'Total / Available RAM', 
            sortable: false,
            render: (row) => row.totalRam !== undefined && row.totalRam !== null ? `${row.totalRam} / ${row.availableRam ?? 0}` : '-'
        },
        { 
            id: 'totalHardisk', 
            label: 'Total / Available HDD', 
            sortable: false,
            render: (row) => row.totalHardisk !== undefined && row.totalHardisk !== null ? `${row.totalHardisk} / ${row.availableHardisk ?? 0}` : '-'
        },
        { 
            id: 'totalCpu', 
            label: 'Total / Available CPU', 
            sortable: false,
            render: (row) => row.totalCpu !== undefined && row.totalCpu !== null ? `${row.totalCpu} / ${row.availableCpu ?? 0}` : '-'
        },
        { id: 'serverModel', label: 'Server Model', sortable: true },
        { id: 'serialNumber', label: 'Serial Number', sortable: true },
        { 
            id: 'admin', 
            label: 'Admin', 
            sortable: true,
            render: (row) => {
                if (Array.isArray(row.admin)) {
                    return row.admin.map((a: string) => usersMap[a] || a).join(', ') || '--';
                }
                return usersMap[row.admin] || row.admin || '--';
            }
        },
        { id: 'hypervisor', label: 'Hypervisor', sortable: true },
        { id: 'applications', label: 'Applications', sortable: true },
        { id: 'clusterType', label: 'Cluster Type', sortable: true },
        { id: 'poNum', label: 'PO Num', sortable: true },
        { id: 'assetNum', label: 'Asset Num', sortable: true }
    ];

    if (hasUpdate || hasDelete) {
        columns.push({
            id: 'id',
            label: 'Actions',
            align: 'right',
            sortable: false,
            render: (row) => (
                <Box className={styles.actionCell}>
                    {hasUpdate && (
                        <Tooltip title="Edit">
                            <IconButton size="small" color="primary" className={styles.actionCell__editBtn} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {hasDelete && (
                        <Tooltip title="Delete">
                            <IconButton size="small" color="error" className={styles.actionCell__deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        });
    }

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>Node Details</Typography>
                <Box className={styles.container__header__search}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search node details..."
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
                                Add Node Details
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>

            <Box className={styles.container__tableContainer}>
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
                    onRowClick={handleRowClick}
                />
            </Box>

            <NodeDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />

            <NodeDetailsViewModal
                open={isViewOpen}
                onClose={() => setIsViewOpen(false)}
                item={selectedViewItem}
                adminName={
                    selectedViewItem
                        ? Array.isArray(selectedViewItem.admin)
                            ? selectedViewItem.admin.map((a: string) => usersMap[a] || a).join(', ')
                            : (usersMap[selectedViewItem.admin] || selectedViewItem.admin)
                        : undefined
                }
            />
        </Box>
    );
};

export default NodeDetails;
