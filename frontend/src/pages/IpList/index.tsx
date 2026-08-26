import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, Tooltip, IconButton, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon, MdRefresh as RefreshIcon } from 'react-icons/md';
import SearchBar from '../../components/SearchBar';
import Dropdown from '../../components/Dropdown';
import Table, { type Column } from '../../components/Table';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useTableState } from '../../hooks/useTableState';
import { fetchIpList, createIp, updateIp, deleteIp } from './action';

import type { IpListModel } from './model';
import type { RootState, AppDispatch } from '../../store';
import IpListFormModal from './IpListFormModal';
import { fetchUsers } from '../Users/action';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

type Order = 'asc' | 'desc';

const IpList: React.FC = () => {
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const dispatch = useDispatch<AppDispatch>();
    
    const { isSuperuser, username, role } = useSelector((state: RootState) => state.auth);
    const { users } = useSelector((state: RootState) => state.users);
    const { data: ips, totalCount, loading } = useSelector((state: RootState) => state.ipList);

    const [page, setPage] = useTableState('ip_list_page', 0);
    const [rowsPerPage, setRowsPerPage] = useTableState('ip_list_rowsPerPage', 25);
    const [searchQuery, setSearchQuery] = useTableState('ip_list_search', '');
    const [isUsedFilter, setIsUsedFilter] = useTableState<'all' | 'free' | 'used'>('ip_list_isUsedFilter', 'all');
    const [userFilter, setUserFilter] = useTableState<string>('ip_list_userFilter', 'all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIp, setEditingIp] = useState<IpListModel | null>(null);

    const [ip, setIp] = useState('');
    const [purpose, setPurpose] = useState('');
    const [takenBy, setTakenBy] = useState('');
    const [isUsed, setIsUsed] = useState(false);

    const hasViewPrivilege = isSuperuser || hasPrivilege(PRIVILEGES.IP_LIST_VIEW);
    const hasCreatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.IP_LIST_CREATE);
    const hasUpdatePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.IP_LIST_UPDATE);
    const hasDeletePrivilege = isSuperuser || hasPrivilege(PRIVILEGES.IP_LIST_DELETE);

    const loggedInUser = useMemo(() => users.find(u => u.username === username), [users, username]);

    // Only show users in the same department as the logged-in user
    const filteredUsers = useMemo(() => {
        if (!loggedInUser || !loggedInUser.department) return isSuperuser ? users : [];
        if (isSuperuser) return users;
        return users.filter(u => u.department === loggedInUser.department);
    }, [users, loggedInUser, isSuperuser]);

    const totalCountRef = useRef(totalCount);
    useEffect(() => {
        totalCountRef.current = totalCount;
    }, [totalCount]);

    const loadData = useCallback(() => {
        if (!hasViewPrivilege) return;

        if (totalCountRef.current > 0 && page * rowsPerPage >= totalCountRef.current) {
            setPage(0);
            return;
        }

        let isUsedParam: boolean | undefined = undefined;
        if (isUsedFilter === 'free') isUsedParam = false;
        else if (isUsedFilter === 'used') isUsedParam = true;

        dispatch(fetchIpList({
            skip: page * rowsPerPage,
            limit: rowsPerPage,
            search: searchQuery,
            isUsed: isUsedParam,
            takenBy: userFilter === 'all' ? undefined : userFilter
        }));
    }, [dispatch, hasViewPrivilege, page, rowsPerPage, searchQuery, isUsedFilter, userFilter, setPage]);

    useEffect(() => {
        dispatch(fetchUsers({ pagination: false }));
    }, [dispatch]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (totalCount > 0 && page * rowsPerPage >= totalCount) {
            setPage(0);
        }
    }, [totalCount, page, rowsPerPage, setPage]);

    const handleResetFilters = () => {
        setSearchQuery('');
        setIsUsedFilter('all');
        setUserFilter('all');
        setPage(0);
    };

    const handleOpenModal = (item?: IpListModel) => {
        if (item) {
            setEditingIp(item);
            setIp(item.ip);
            setPurpose(item.purpose || '');
            setTakenBy(item.takenBy || '');
            setIsUsed(item.isUsed);
        } else {
            setEditingIp(null);
            setIp('');
            setPurpose('');
            setTakenBy('');
            setIsUsed(false);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ip,
                purpose,
                isUsed,
                takenBy: isUsed ? takenBy : ''
            };
            if (editingIp) {
                await dispatch(updateIp({ id: editingIp.id || editingIp._id || '', payload })).unwrap();
                showToast('IP updated successfully', 'success');
            } else {
                await dispatch(createIp(payload)).unwrap();
                showToast('IP created successfully', 'success');
            }
            handleCloseModal();
        } catch (err: any) {
            showToast(err || 'Failed to save IP', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirm("Are you sure you want to delete this IP?")) {
            try {
                await dispatch(deleteIp(id)).unwrap();
                showToast('IP deleted successfully', 'success');
                if (ips.length === 1 && page > 0) {
                    setPage(page - 1);
                }
            } catch (err: any) {
                showToast(err || 'Failed to delete IP', 'error');
            }
        }
    };

    const columns: Column<IpListModel>[] = [
        {
            id: 'ip',
            label: 'IP Address',
            sortable: false,
            render: (row) => row.ip
        },
        {
            id: 'purpose',
            label: 'Purpose',
            sortable: false,
            render: (row) => row.purpose || '-'
        },
        {
            id: 'isUsed',
            label: 'Status',
            sortable: false,
            render: (row) => (
                <Chip
                    label={row.isUsed ? 'Used' : 'Free'}
                    color={row.isUsed ? 'error' : 'success'}
                    size="small"
                />
            )
        },
        {
            id: 'takenBy',
            label: 'Taken By',
            sortable: false,
            render: (row) => {
                if (!row.isUsed || !row.takenBy) return '-';
                const u = users.find(u => u.username === row.takenBy);
                return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : row.takenBy;
            }
        },
        {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            render: (row) => (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {hasUpdatePrivilege && (
                        <Tooltip title="Edit IP">
                            <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {hasDeletePrivilege && (
                        <Tooltip title="Delete IP">
                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row.id || row._id || ''); }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )
        }
    ];

    if (!hasViewPrivilege) {
        return (
            <Box sx={{ p: 3 }}>
                <h2 style={{ margin: 0, color: '#333' }}>Access Denied</h2>
                <p>You do not have permission to view IP List.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <h2 style={{ margin: 0, color: '#333' }}>IP List</h2>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <SearchBar
                        value={searchQuery}
                        onChange={(v) => { setSearchQuery(v); setPage(0); }}
                        placeholder="Search IP or purpose..."
                    />
                    
                    <ToggleButtonGroup
                        value={isUsedFilter}
                        exclusive
                        onChange={(e, val) => {
                            if (val) {
                                setIsUsedFilter(val);
                                setPage(0);
                            }
                        }}
                        size="small"
                        sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 0.5, borderRadius: '8px' }}
                    >
                        <ToggleButton value="all" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                            All
                        </ToggleButton>
                        <ToggleButton value="free" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                            Free
                        </ToggleButton>
                        <ToggleButton value="used" sx={{ border: 'none', borderRadius: '6px !important', px: 2, py: 0.5, fontSize: '0.8rem' }}>
                            Used
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Dropdown
                        label="Taken By"
                        value={userFilter}
                        onChange={(val) => { setUserFilter(val); setPage(0); }}
                        options={[
                            { label: 'All Users', value: 'all' },
                            ...filteredUsers.map(u => ({
                                label: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                                value: u.username
                            }))
                        ]}
                        size="small"
                        fullWidth={false}
                        sx={{ minWidth: 150, width: 200 }}
                        searchable
                    />

                    <Button variant="outlined" color="inherit" startIcon={<RefreshIcon />} onClick={handleResetFilters}>
                        Reset
                    </Button>

                    {hasCreatePrivilege && (
                        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
                            Add IP
                        </Button>
                    )}
                </Box>
            </Box>

            <Paper sx={{ width: '100%', mb: 2, p: 0, boxShadow: 'none', background: 'transparent' }}>
                <Table
                    columns={columns}
                    data={ips}
                    loading={loading}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    totalCount={totalCount}
                />
            </Paper>

            <IpListFormModal
                isModalOpen={isModalOpen}
                handleCloseModal={handleCloseModal}
                editingIp={editingIp}
                ip={ip}
                setIp={setIp}
                purpose={purpose}
                setPurpose={setPurpose}
                takenBy={takenBy}
                setTakenBy={setTakenBy}
                isUsed={isUsed}
                setIsUsed={setIsUsed}
                users={filteredUsers}
                handleSubmit={handleSubmit}
            />
        </Box>
    );
};

export default IpList;
