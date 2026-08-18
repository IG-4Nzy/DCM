import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { validators } from '../../../helpers/validation';
import { type ServerModelData, type CreateServerModelPayload, type UpdateServerModelPayload } from './model';

interface ServerModelModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateServerModelPayload | UpdateServerModelPayload) => void;
    editingItem: ServerModelData | null;
}

const ServerModelModal: React.FC<ServerModelModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [serverModel, setField] = useState('');
    const [remarks, setRemarks] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setErrors({});
            if (editingItem) {
                setField(editingItem.serverModel);
                setRemarks(editingItem.remarks || '');
            } else {
                setField('');
                setRemarks('');
            }
        }
    }, [open, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const modelErr = validators.alphanumericSpaces(serverModel, 50, "Server Model");
        const remarksErr = validators.alphanumericGeneral(remarks, 125, "Remarks");

        const newErrors = {
            serverModel: modelErr,
            remarks: remarksErr
        };

        setErrors(newErrors);

        if (modelErr || remarksErr) {
            return;
        }
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, serverModel: serverModel.trim(), remarks: remarks.trim() });
        } else {
            onSubmit({ serverModel: serverModel.trim(), remarks: remarks.trim() });
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Server Model' : 'Add Server Model'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Server Model"
                        placeholder="Dell PowerEdge"
                        value={serverModel}
                        onChange={(e) => {
                            setField(e.target.value);
                            setErrors(prev => ({ ...prev, serverModel: '' }));
                        }}
                        required
                        error={!!errors.serverModel}
                        helperText={errors.serverModel}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Remarks"
                            placeholder="Enter remarks..."
                            value={remarks}
                            onChange={(e) => {
                                setRemarks(e.target.value);
                                setErrors(prev => ({ ...prev, remarks: '' }));
                            }}
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

export default ServerModelModal;
