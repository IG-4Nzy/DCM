import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type ClusterTypeData, type CreateClusterTypePayload, type UpdateClusterTypePayload } from './model';

interface ClusterTypeModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateClusterTypePayload | UpdateClusterTypePayload) => void;
    editingItem: ClusterTypeData | null;
}

const ClusterTypeModal: React.FC<ClusterTypeModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [clusterType, setClusterType] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setClusterType(editingItem.clusterType);
                setRemarks(editingItem.remarks || '');
            } else {
                setClusterType('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clusterType.trim()) return;
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, clusterType, remarks });
        } else {
            onSubmit({ clusterType, remarks });
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Cluster Type' : 'Add Cluster Type'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Cluster Type"
                        placeholder="VM Ware"
                        value={clusterType}
                        onChange={(e) => setClusterType(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Remarks"
                        placeholder="Enter remarks..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                    <Button variant="text" onClick={onClose} style={{ color: '#637381' }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" color="primary">
                        {editingItem ? 'Update' : 'Save'}
                    </Button>
                </Box>
            </form>
        </Modal>
    );
};

export default ClusterTypeModal;
