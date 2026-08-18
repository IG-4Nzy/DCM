// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
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
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setErrors({});
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
        
        const nameErr = !gpuName ? "GPU Name is required" :
                        !/^[a-zA-Z0-9\s/+-]+$/.test(gpuName) ? "GPU Name must contain alphanumeric characters, spaces, slashes, pluses or dashes only" :
                        gpuName.length > 50 ? "GPU Name must be maximum 50 characters" : "";
        const remarksErr = remarks && !/^[a-zA-Z0-9\s,.-]+$/.test(remarks) ? "Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only" :
                           remarks.length > 125 ? "Remarks must be maximum 125 characters" : "";

        const newErrors = {
            gpuName: nameErr,
            remarks: remarksErr
        };

        setErrors(newErrors);

        if (nameErr || remarksErr) {
            return;
        }

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
                        onChange={(e) => {
                            setGpuName(e.target.value);
                            setErrors(prev => ({ ...prev, gpuName: '' }));
                        }}
                        required
                        error={!!errors.gpuName}
                        helperText={errors.gpuName}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <TextField
                            fullWidth
                            label="Remarks"
                            placeholder="Optional remarks"
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                setErrors(prev => ({ ...prev, remarks: '' }));
                            }}
                            multiline
                            rows={3}
                            error={!!errors.remarks}
                            helperText={errors.remarks}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {remarks ? remarks.length : 0} / 125
                            </span>
                        </div>
                    </Box>
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

export default GPUModal;
