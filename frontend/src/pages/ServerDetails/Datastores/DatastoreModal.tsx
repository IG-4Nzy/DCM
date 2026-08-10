// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import styles from './modal.module.scss';

interface DatastoreModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: any | null;
}

const DATASTORE_TYPES = [
    { label: 'VMFS', value: 'VMFS' },
    { label: 'NFS', value: 'NFS' },
    { label: 'vSAN', value: 'vSAN' },
    { label: 'iSCSI', value: 'iSCSI' },
    { label: 'Local', value: 'Local' },
    { label: 'Other', value: 'Other' },
];

const DatastoreModal: React.FC<DatastoreModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        capacity: '',
    });

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    name: editingItem.name || '',
                    type: editingItem.type || '',
                    capacity: editingItem.capacity || '',
                });
            } else {
                setFormData({
                    name: '',
                    type: '',
                    capacity: '',
                });
            }
        }
    }, [open, editingItem]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingItem) {
            const changedData: any = {};
            if (formData.name !== (editingItem.name || '')) changedData.name = formData.name;
            if (formData.type !== (editingItem.type || '')) changedData.type = formData.type;
            if (formData.capacity !== (editingItem.capacity || '')) changedData.capacity = formData.capacity;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Datastore' : 'Add Datastore'}
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.formGrid}>
                    <TextField 
                        label="Datastore Name" 
                        size="small"
                        required
                        className={styles.formGrid__field}
                        value={formData.name} 
                        onChange={(e) => handleChange('name', e.target.value)} 
                    />
                    <Dropdown 
                        label="Type" 
                        size="small"
                        fullWidth
                        searchable
                        value={formData.type} 
                        onChange={(val) => handleChange('type', val)} 
                        options={DATASTORE_TYPES}
                    />
                    <TextField 
                        label="Capacity" 
                        size="small"
                        required
                        className={styles.formGrid__field}
                        value={formData.capacity} 
                        onChange={(e) => handleChange('capacity', e.target.value)} 
                        placeholder="e.g. 500 GB, 2 TB"
                    />
                </Box>
                <Box className={styles.buttonContainer}>
                    <Button variant="outlined" onClick={onClose} sx={{ color: '#637381', borderColor: '#637381' }}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">{editingItem ? 'Update' : 'Submit'}</Button>
                </Box>
            </form>
        </Modal>
    );
};

export default DatastoreModal;
