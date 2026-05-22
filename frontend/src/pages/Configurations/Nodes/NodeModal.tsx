import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
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

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.node);
                setRemarks(editingItem.remarks || '');
            } else {
                setField('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!node.trim()) return;
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, node, remarks });
        } else {
            onSubmit({ node, remarks });
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
                        label="Node"
                        placeholder="Node-01"
                        value={node}
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

export default NodeModal;
