// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
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
import { fetchDatastores, createDatastore, updateDatastore, deleteDatastore } from './action';
import { type DatastoreData } from './model';
import DatastoreModal from './DatastoreModal';
import styles from './index.module.scss';

const Datastores = () => {
    const [data, setData] = useState<DatastoreData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DatastoreData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                search: searchQuery,
                pagination: true
            };
            const result = await fetchDatastores(params);
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load Datastores', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, searchQuery, showToast]);

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

    const handleSubmit = async (formData: any) => {
        try {
            if (editingItem) {
                if (Object.keys(formData).length === 0) {
                    handleCloseModal();
                    return;
                }
                await updateDatastore(editingItem.id || editingItem._id, formData);
                showToast('Datastore updated successfully', 'success');
            } else {
                await createDatastore(formData);
                showToast('Datastore created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const isConfirmed = await confirm(`Are you sure you want to delete datastore "${name}"? This action cannot be undone.`, 'Delete Datastore');
        if (isConfirmed) {
            try {
                await deleteDatastore(id);
                showToast('Datastore deleted successfully', 'success');
                if (data.length === 1 && page > 0) {
                    setPage(page - 1);
                } else {
                    loadData();
                }
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete Datastore', 'error');
            }
        }
    };

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>Datastores</Typography>
                <Box className={styles.container__header__search}>
                    <SearchBar
                        value={searchQuery}
                        onChange={(val) => { setSearchQuery(val); setPage(0); }}
                        placeholder="Search datastores..."
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

            <Paper className={styles.tableWrapper}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow className={styles.tableWrapper__headerRow}>
                                <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 60 }}>#</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 200 }}>Name</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 120 }}>Type</TableCell>
                                <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 120 }}>Capacity</TableCell>
                                {isSuperuser && (
                                    <>
                                        <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 140 }}>Created By</TableCell>
                                        <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 160 }}>Created At</TableCell>
                                        <TableCell className={styles.tableWrapper__headerCell} sx={{ minWidth: 160 }}>Last Updated</TableCell>
                                    </>
                                )}
                                {(hasUpdate || hasDelete) && (
                                    <TableCell className={styles.tableWrapper__headerCellLast} align="right" sx={{ minWidth: 100 }}>Actions</TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4 + (isSuperuser ? 3 : 0) + ((hasUpdate || hasDelete) ? 1 : 0)} align="center" sx={{ py: 3, color: 'text.secondary' }}>Loading...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4 + (isSuperuser ? 3 : 0) + ((hasUpdate || hasDelete) ? 1 : 0)} align="center" sx={{ py: 3, color: 'text.secondary' }}>No Datastores found</TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, idx) => (
                                    <TableRow key={row.id || row._id} hover>
                                        <TableCell className={styles.tableWrapper__cell}>{page * rowsPerPage + idx + 1}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell} sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.type || '--'}</TableCell>
                                        <TableCell className={styles.tableWrapper__cell}>{row.capacity || '--'}</TableCell>
                                        {isSuperuser && (
                                            <>
                                                <TableCell className={styles.tableWrapper__cell}>{row.createdBy || '--'}</TableCell>
                                                <TableCell className={styles.tableWrapper__cell}>{row.createdAt ? dayjs(row.createdAt).format('DD/MM/YYYY HH:mm') : '--'}</TableCell>
                                                <TableCell className={styles.tableWrapper__cell}>{row.updatedAt ? dayjs(row.updatedAt).format('DD/MM/YYYY HH:mm') : '--'}</TableCell>
                                            </>
                                        )}
                                        {(hasUpdate || hasDelete) && (
                                            <TableCell align="right">
                                                <Box className={styles.tableWrapper__actions}>
                                                    {hasUpdate && (
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" className={styles.tableWrapper__actions__editBtn} onClick={() => handleOpenModal(row)}>
                                                                <EditIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {hasDelete && (
                                                        <Tooltip title="Delete">
                                                            <IconButton size="small" className={styles.tableWrapper__actions__deleteBtn} onClick={() => handleDelete(row.id || row._id, row.name)}>
                                                                <DeleteIcon color="error" />
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
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
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
