import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type ClusterData, type CreateClusterPayload, type UpdateClusterPayload } from '../model';
import styles from "./index.module.scss"

interface ClusterModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateClusterPayload | UpdateClusterPayload) => void;
    editingItem: ClusterData | null;
}

const ClusterModal: React.FC<ClusterModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [formData, setFormData] = useState<CreateClusterPayload>({
        clusterName: '',
        ipAddress: ''
    });

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    clusterName: editingItem.clusterName || '',
                    ipAddress: editingItem.ipAddress || ''
                });
            } else {
                setFormData({
                    clusterName: '',
                    ipAddress: ''
                });
            }
        }
    }, [open, editingItem]);

    const handleChange = (field: keyof CreateClusterPayload, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingItem) {
            const changedData: UpdateClusterPayload = {};
            if (formData.clusterName !== editingItem.clusterName) changedData.clusterName = formData.clusterName;
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Cluster' : 'Add Cluster'}
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.container}>
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="Cluster Name"
                            value={formData.clusterName}
                            onChange={(e) => handleChange('clusterName', e.target.value)}
                            required
                        />
                    </Box>
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="IP Address"
                            value={formData.ipAddress}
                            onChange={(e) => handleChange('ipAddress', e.target.value)}
                            required
                        />
                    </Box>
                </Box>
                <Box className={styles["container__buttonContainer"]}>
                    <Button variant="outlined" onClick={onClose} sx={{ color: '#637381', borderColor: '#637381' }}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">{editingItem ? 'Update' : 'Submit'}</Button>
                </Box>
            </form>
        </Modal>
    );
};

export default ClusterModal;
