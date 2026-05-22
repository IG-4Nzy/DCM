import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type ServerRackData, type CreateServerRackPayload, type UpdateServerRackPayload } from './model';

interface ServerRackModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateServerRackPayload | UpdateServerRackPayload) => void;
    editingItem: ServerRackData | null;
}

const ServerRackModal: React.FC<ServerRackModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [serverRack, setField] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.serverRack);
                setRemarks(editingItem.remarks || '');
            } else {
                setField('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!serverRack.trim()) return;
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, serverRack, remarks });
        } else {
            onSubmit({ serverRack, remarks });
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Server Rack' : 'Add Server Rack'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Server Rack"
                        placeholder="Rack A1"
                        value={serverRack}
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

export default ServerRackModal;
