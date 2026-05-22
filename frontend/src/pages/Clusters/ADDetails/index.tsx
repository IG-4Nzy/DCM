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
import { fetchADDetails, createADDetails, updateADDetails, deleteADDetails } from './action';
import { type ADDetailsData } from './model';
import ADDetailsModal from './ADDetailsModal';

interface ADDetailsProps {
    clusterId: string;
}

const ADDetails = ({ clusterId }: ADDetailsProps) => {
    const [data, setData] = useState<ADDetailsData[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ADDetailsData | null>(null);

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const hasCreate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_CREATE);
    const hasUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_UPDATE);
    const hasDelete = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_DELETE);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchADDetails({
                clusterId,
                search: searchQuery,
                pagination: false
            });
            setData(result.data);
            setTotalCount(result.total);
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Failed to load AD Details', 'error');
        } finally {
            setLoading(false);
        }
    }, [clusterId, searchQuery, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item?: ADDetailsData) => {
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
                await updateADDetails(editingItem.id, formData);
                showToast('AD Details updated successfully', 'success');
            } else {
                await createADDetails(formData);
                showToast('AD Details created successfully', 'success');
            }
            handleCloseModal();
            loadData();
        } catch (e: any) {
            showToast(e?.response?.data?.detail || 'Operation failed', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm('Are you sure you want to delete this AD Details record? This action cannot be undone.', 'Delete AD Details');
        if (isConfirmed) {
            try {
                await deleteADDetails(id);
                showToast('AD Details deleted successfully', 'success');
                loadData();
            } catch (e: any) {
                showToast(e?.response?.data?.detail || 'Failed to delete AD Details', 'error');
            }
        }
    };

    return (
        <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" fontWeight="bold">AD Details</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
                            Add AD Details
                        </Button>
                    )}
                </Box>
            </Box>

            <Grid container spacing={3}>
                {data.map((item) => (
                    <Grid item xs={12} key={item.id}>
                        <Card sx={{ 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            position: 'relative',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }
                        }}>
                            <CardContent sx={{ pb: '16px !important' }}>
                                <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom sx={{ wordBreak: 'break-word', mb: 2 }}>
                                    {item.name || '--'}
                                </Typography>
                                
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">IP Address</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.ipAddress || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">HDD</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.hdd || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">RAM</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.ram || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">CPU Cores</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.cpuCores || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">OS Type</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.osType || '--'}</Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">OS Version</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.osVersion || '--'}</Typography>
                                    </Box>
                                    
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">Licence Expiry</Typography>
                                        <Typography variant="body2" fontWeight="500" sx={{ wordBreak: 'break-word' }}>{item.licenceExpiry || '--'}</Typography>
                                    </Box>
                                </Box>

                                {(hasUpdate || hasDelete) && (
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
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
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No AD Details found. Click "Add AD Details" to create one.
                </Box>
            )}

            <ADDetailsModal
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                clusterId={clusterId}
            />
        </Box>
    );
};

export default ADDetails;
