// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import { type GPUData, type CreateGPUPayload, type UpdateGPUPayload } from './model';

interface GPUModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateGPUPayload | UpdateGPUPayload) => void;
    editingItem: GPUData | null;
}

const GPUModal: React.FC<GPUModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [gpuName, setGpuName] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setGpuName(editingItem.gpuName || '');
                setRemarks(editingItem.remarks || '');
            } else {
                setGpuName('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!gpuName.trim()) return;

        if (editingItem) {
            onSubmit({ id: editingItem.id, gpuName: gpuName.trim(), remarks: remarks.trim() || undefined });
        } else {
            onSubmit({ gpuName: gpuName.trim(), remarks: remarks.trim() || undefined });
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit GPU' : 'Add GPU'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="GPU Name"
                        placeholder="e.g. NVIDIA A100 / RTX 4090"
                        value={gpuName}
                        onChange={(e) => setGpuName(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        label="Remarks"
                        placeholder="Optional remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        multiline
                        rows={3}
                    />
                </Box>
            </form>
        </Modal>
    );
};

export default GPUModal;
