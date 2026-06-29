// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Box, Tooltip, IconButton, Card, CardContent, Typography, Grid } from '@mui/material';
import { MdAdd as AddIcon, MdEdit as EditIcon, MdDelete as DeleteIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import SearchBar from '../../../components/SearchBar';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { fetchVCenterDetails, createVCenterDetails, updateVCenterDetails, deleteVCenterDetails } from './action';
import { type VCenterDetailsData } from './model';
import VCenterDetailsModal from './VCenterDetailsModal';
import styles from './index.module.scss';

interface VCenterDetailsProps {
    clusterId: string;
}

const VCenterDetails = ({ clusterId }: VCenterDetailsProps) => {
    const [data, setData] = useState<VCenterDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<VCenterDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_DELETE);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchVCenterDetails({
                clusterId,
                search: searchQuery,
                pagination: false
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load vCenter Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: VCenterDetailsData) => {
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
                await updateVCenterDetails(editingItem.id, formData);
                showToast('vCenter Details updated successfully', 'success');
            } else {
                await createVCenterDetails(formData);
                showToast('vCenter Details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm('Are you sure you want to delete this vCenter Details record? This action cannot be undone.', 'Delete vCenter Details');
        if (isConfirmed) {
            try {
                await deleteVCenterDetails(id);
                showToast('vCenter Details deleted successfully', 'success');
                loadData();
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete vCenter Details', 'error');
            }
        }
    };

    return (
        <Box className={styles.container}>
            <Box className={styles.container__header}>
                <Typography variant="h6" className={styles.container__header__label}>vCenter Details</Typography>
                <Box className={styles.container__header__search}>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search IP or Name..."
                    />
                    {hasCreate && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenModal()}
                        >
                            Add vCenter Details
                        </Button>
                    )}
                </Box>
            </Box>

            <Grid container spacing={3}>
                {data.map((item) => (
                    <Grid size={{xs: 12}}   key={item.id}>
                        <Card className={styles.card}>
                            <CardContent className={styles.card__content}>
                                <Typography variant="h6" color="primary" gutterBottom className={styles.card__title}>
                                    {item.name || '--'}
                                </Typography>
                                
                                <Box className={styles.card__grid}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >IP Address</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.ipAddress || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >HDD</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.hdd || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >RAM</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.ram || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >CPU Cores</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.cpuCores || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >vCenter Type</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.vcenterType || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >vCenter Version</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.vcenterVersion || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >Licence Expiry</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.licenceExpiry || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >HA</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.ha || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >DRS</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.drs || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >Storage</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.storage || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >Port Groups</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.portGroups || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary"  sx={{ display: 'block' }} >VM Image Backup Location</Typography>
                                        <Typography variant="body2" fontWeight="500" className={styles.card__grid__item__value}>{item.vmImageBackupLocation || '--'}</Typography>
                                    </Box>
                                </Box>

                                {(hasUpdate || hasDelete) && (
                                    <Box className={styles.card__actions}>
                                        {hasUpdate && (
                                            <Tooltip title="Edit">
                                                <IconButton size="small" color="primary" onClick={() => handleOpenModal(item)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {hasDelete && (
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {data.length === 0 && !loading && (
                <Box className={styles.emptyState}>
                    No vCenter Details found. Click "Add vCenter Details" to create one.
                </Box>
            )}

            <VCenterDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />
        </Box>
    );
};

export default VCenterDetails;
