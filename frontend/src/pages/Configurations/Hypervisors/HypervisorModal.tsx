// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type HypervisorData, type CreateHypervisorPayload, type UpdateHypervisorPayload } from './model';

interface HypervisorModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateHypervisorPayload | UpdateHypervisorPayload) => void;
    editingItem: HypervisorData | null;
}

const HypervisorModal: React.FC<HypervisorModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [hypervisor, setField] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.hypervisor);
                setRemarks(editingItem.remarks || '');
            } else {
                setField('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!hypervisor.trim()) return;
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, hypervisor, remarks });
        } else {
            onSubmit({ hypervisor, remarks });
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Hypervisor' : 'Add Hypervisor'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Hypervisor"
                        placeholder="vSphere"
                        value={hypervisor}
                        onChange={(e) => setField(e.target.value)}
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

export default HypervisorModal;
