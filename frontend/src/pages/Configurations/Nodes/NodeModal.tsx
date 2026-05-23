import React, { useState, useEffect } from 'react';
import { Box, Grid } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type NodeData, type CreateNodePayload, type UpdateNodePayload } from './model';

interface NodeModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateNodePayload | UpdateNodePayload) => void;
    editingItem: NodeData | null;
}

const NodeModal: React.FC<NodeModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [node, setField] = useState('');
    const [remarks, setRemarks] = useState('');
    const [totalRam, setTotalRam] = useState<string>('');
    const [totalHardisk, setTotalHardisk] = useState<string>('');
    const [totalCpu, setTotalCpu] = useState<string>('');

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.node);
                setRemarks(editingItem.remarks || '');
                setTotalRam(editingItem.totalRam !== undefined && editingItem.totalRam !== null ? String(editingItem.totalRam) : '');
                setTotalHardisk(editingItem.totalHardisk !== undefined && editingItem.totalHardisk !== null ? String(editingItem.totalHardisk) : '');
                setTotalCpu(editingItem.totalCpu !== undefined && editingItem.totalCpu !== null ? String(editingItem.totalCpu) : '');
            } else {
                setField('');
                setRemarks('');
                setTotalRam('');
                setTotalHardisk('');
                setTotalCpu('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!node.trim()) return;
        
        const payload: any = {
            node,
            remarks,
            totalRam: totalRam.trim() !== '' ? Number(totalRam) : undefined,
            totalHardisk: totalHardisk.trim() !== '' ? Number(totalHardisk) : undefined,
            totalCpu: totalCpu.trim() !== '' ? Number(totalCpu) : undefined
        };

        if (editingItem) {
            onSubmit({ id: editingItem.id, ...payload });
        } else {
            onSubmit(payload);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Node' : 'Add Node'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Node Name"
                        placeholder="e.g. Node-01"
                        value={node}
                        onChange={(e) => setField(e.target.value)}
                        required
                    />
                    
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Total RAM (GB)"
                                placeholder="e.g. 128"
                                value={totalRam}
                                onChange={(e) => setTotalRam(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Total HDD (GB)"
                                placeholder="e.g. 1000"
                                value={totalHardisk}
                                onChange={(e) => setTotalHardisk(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Total CPU (Cores)"
                                placeholder="e.g. 32"
                                value={totalCpu}
                                onChange={(e) => setTotalCpu(e.target.value)}
                            />
                        </Grid>
                    </Grid>

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

export default NodeModal;
