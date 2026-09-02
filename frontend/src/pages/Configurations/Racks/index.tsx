// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { Box, Paper, Tooltip, IconButton, Button as MuiButton, ToggleButton, ToggleButtonGroup, Table as MuiTable, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Chip } from '@mui/material';
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
import NodeViewModal from '../Nodes/NodeViewModal';
import request from '../../../services/request';

type Order = 'asc' | 'desc';

const matchesPosition = (nodeRackPosition: string | number | undefined, posIndex: number) => {
    if (nodeRackPosition === undefined || nodeRackPosition === null || nodeRackPosition === '') return false;
    const str = String(nodeRackPosition).trim().toLowerCase();
    
    // Split by comma, slash, or semicolon
    const parts = str.split(/[,;/]+/).map(p => p.trim()).filter(Boolean);
    
    for (const part of parts) {
        // Range matching (e.g. M01-M04, M 01 - M 04, 1-4, U01-U04, U 1 - U 4)
        const rangeMatch = part.match(/(?:[mu]?\s*-?\s*)?(\d+)\s*[-–—]\s*(?:[mu]?\s*-?\s*)?(\d+)/i);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            if (posIndex >= min && posIndex <= max) {
                return true;
            }
        } else {
            // Single value extraction (e.g. M01, M-1, U1, 1, 01)
            const digitsMatch = part.match(/(\d+)/);
            if (digitsMatch) {
                const val = parseInt(digitsMatch[1], 10);
                if (val === posIndex) {
                    return true;
                }
            }
        }
    }
    return false;
};

const matchesRack = (nodeRack: any, rack: ServerRackData) => {
    if (!nodeRack || !rack) return false;
    let nRackStr = typeof nodeRack === 'object'
        ? (nodeRack.serverRack || nodeRack.name || nodeRack.id || nodeRack._id || '')
        : String(nodeRack);
    nRackStr = nRackStr.trim().toLowerCase();
    const rNameStr = rack.serverRack ? String(rack.serverRack).trim().toLowerCase() : '';
    const rIdStr = rack.id ? String(rack.id).trim().toLowerCase() : '';
    const rUnderscoreIdStr = (rack as any)._id ? String((rack as any)._id).trim().toLowerCase() : '';

    if (nRackStr === rNameStr || nRackStr === rIdStr || nRackStr === rUnderscoreIdStr) {
        return true;
    }
    
    // Normalize string by removing spaces, dashes, and underscores
    const normNRack = nRackStr.replace(/[\s\-_]/g, '');
    const normRName = rNameStr.replace(/[\s\-_]/g, '');
    return normNRack && normRName && normNRack === normRName;
};

const Racks = () => {
    const [data, setData] = useState<ServerRackData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ServerRackData | null>(null);
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
    const hasView = isSuperuser || hasPrivilege(PRIVILEGES.RACKS_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS) || hasPrivilege(PRIVILEGES.VIEW_SERVER_DETAILS) || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [searchQuery, setSearchQuery] = useTableState('Racks_search', '');
    const [page, setPage] = useTableState('Racks_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('Racks_rowsPerPage', 5);
    const [order, setOrder] = useTableState<Order>('Racks_order', 'asc');
    const [orderBy, setOrderBy] = useTableState<string>('Racks_orderBy', 'serverRack');

    const [viewMode, setViewMode] = useState<'list' | 'layout'>('list');
    const [nodes, setNodes] = useState<any[]>([]);
    const [allRacks, setAllRacks] = useState<ServerRackData[]>([]);
    const [selectedNodeForView, setSelectedNodeForView] = useState<any | null>(null);
    const [isNodeViewModalOpen, setIsNodeViewModalOpen] = useState(false);

    const loadNodes = useCallback(async () => {
        try {
            const res = await request.get('/api/nodes/', { params: { pagination: false } });
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setNodes(list);
        } catch (err) {
            console.error("Failed to load nodes", err);
        }
    }, []);

    const loadAllRacks = useCallback(async () => {
        try {
            const result = await fetchServerRacks({ pagination: false, sortBy: 'serverRack', order: 'asc' });
            const list = Array.isArray(result) ? result : (result.data || []);
            setAllRacks(list);
        } catch (err) {
            console.error("Failed to load all racks", err);
        }
    }, []);

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
        loadNodes();
        loadAllRacks();
    }, [loadData, loadNodes, loadAllRacks]);

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
            render: (row) => `${row.remainingCapacity ?? (row.rackCapacity || 42)} U / ${row.rackCapacity || 42} U`
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

    if (isSuperuser) {
        columns.push(
            {
                id: 'createdBy',
                label: 'Created By',
                sortable: true,
                render: (row) => usersMap[row.createdBy || ''] || row.createdBy || '-'
            },
            {
                id: 'createdAt',
                label: 'Created At',
                sortable: true,
                render: (row) => row.createdAt ? dayjs(row.createdAt).format('DD-MM-YYYY h:mm A') : '-'
            },
            {
                id: 'updatedBy',
                label: 'Updated By',
                sortable: true,
                render: (row) => usersMap[row.updatedBy || ''] || row.updatedBy || '-'
            },
            {
                id: 'updatedAt',
                label: 'Updated At',
                sortable: true,
                render: (row) => row.updatedAt ? dayjs(row.updatedAt).format('DD-MM-YYYY h:mm A') : '-'
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

    const positions = Array.from({ length: 42 }, (_, idx) => idx + 1);

    return (
        <Box sx={{ mt: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, val) => val && setViewMode(val)}
                        size="small"
                        color="primary"
                    >
                        <ToggleButton value="list" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                            List View
                        </ToggleButton>
                        <ToggleButton value="layout" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                            Nodes Placement View
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search server racks..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add Server Rack
                        </Button>
                    )}
                </Box>
            </Box>

            {viewMode === 'list' ? (
                <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            ) : (
                <Paper
                    elevation={0}
                    sx={{
                        width: '100%',
                        overflow: 'hidden',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: "0px",
                        display: 'flex',
                        flexDirection: 'column',
                        mb: 2,
                        flexGrow: 1
                    }}
                >
                    <TableContainer sx={{ overflow: 'auto', maxHeight: 600 }}>
                        <MuiTable stickyHeader sx={{ minWidth: 650 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell
                                        sx={{
                                            backgroundColor: '#f4f6f8',
                                            color: '#637381',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            borderBottom: 'none',
                                            whiteSpace: 'nowrap',
                                            width: 150,
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 3
                                        }}
                                    >
                                        Position / U
                                    </TableCell>
                                    {allRacks.map((rack) => (
                                        <TableCell
                                            key={rack.id}
                                            align="center"
                                            sx={{
                                                backgroundColor: '#f4f6f8',
                                                color: '#212b36',
                                                fontWeight: 600,
                                                fontSize: '0.875rem',
                                                borderBottom: 'none',
                                                whiteSpace: 'nowrap',
                                                minWidth: 150
                                            }}
                                        >
                                            {rack.serverRack}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {positions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={allRacks.length + 1} align="center" sx={{ py: 6 }}>
                                            <span style={{ color: '#919eab', fontWeight: 500 }}>No racks to display</span>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    positions.map((pos) => {
                                        const posLabel = `M ${String(pos).padStart(2, '0')}`;
                                        return (
                                            <TableRow
                                                key={pos}
                                                hover
                                                sx={{
                                                    '&:hover': { backgroundColor: '#f9fafb !important' },
                                                    transition: 'background-color 0.2s ease',
                                                    '& td': { borderBottom: '1px solid #f1f3f4' }
                                                }}
                                            >
                                                <TableCell sx={{ color: '#637381', fontWeight: 500, fontSize: '0.875rem', position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1 }}>
                                                    {posLabel}
                                                </TableCell>
                                                {allRacks.map((rack) => {
                                                    const matchingNodes = nodes.filter(node => matchesRack(node.rack, rack) && matchesPosition(node.rackPosition, pos));

                                                    return (
                                                        <TableCell key={rack.id} align="center">
                                                            {matchingNodes.length > 0 ? (
                                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                                                                    {matchingNodes.map(n => {
                                                                        const nodeName = n.node || n.nodeId || '';
                                                                        return (
                                                                            <Tooltip key={n.id} title={nodeName} arrow>
                                                                                <Chip
                                                                                    label={nodeName}
                                                                                    size="small"
                                                                                    color="primary"
                                                                                    variant="outlined"
                                                                                    clickable
                                                                                    onClick={() => {
                                                                                        setSelectedNodeForView(n);
                                                                                        setIsNodeViewModalOpen(true);
                                                                                    }}
                                                                                    sx={{
                                                                                        fontWeight: 600,
                                                                                        borderRadius: '6px',
                                                                                        backgroundColor: 'rgba(25, 118, 210, 0.04)',
                                                                                        borderColor: 'rgba(25, 118, 210, 0.2)',
                                                                                        cursor: 'pointer',
                                                                                        width: '130px',
                                                                                        height: '28px',
                                                                                        '& .MuiChip-label': {
                                                                                            display: 'block',
                                                                                            overflow: 'hidden',
                                                                                            textOverflow: 'ellipsis',
                                                                                            whiteSpace: 'nowrap',
                                                                                            px: 1,
                                                                                            width: '100%'
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </Tooltip>
                                                                        );
                                                                    })}
                                                                </Box>
                                                            ) : null}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </MuiTable>
                    </TableContainer>
                </Paper>
            )}

            <ServerRackModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
            />

            <NodeViewModal
                open={isNodeViewModalOpen}
                onClose={() => {
                    setIsNodeViewModalOpen(false);
                    setSelectedNodeForView(null);
                }}
                node={selectedNodeForView}
                adminName={
                    selectedNodeForView
                        ? Array.isArray(selectedNodeForView.admin)
                            ? selectedNodeForView.admin
                                .map((a: string) => usersMap[a] || a)
                                .join(", ")
                            : usersMap[selectedNodeForView.admin] || selectedNodeForView.admin
                        : undefined
                }
            />
        </Box>
    );
};

export default Racks;
