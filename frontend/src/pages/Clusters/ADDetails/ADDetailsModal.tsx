import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { type ADDetailsData, type CreateADDetailsPayload, type UpdateADDetailsPayload } from './model';
import styles from './modal.module.scss';

interface ADDetailsModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: ADDetailsData | null;
    clusterId: string;
}

const ADDetailsModal: React.FC<ADDetailsModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreateADDetailsPayload>({
        clusterId: clusterId,
        ipAddress: '',
        name: '',
        hdd: '',
        ram: '',
        cpuCores: '',
        osVersion: '',
        osType: '',
        licenceExpiry: ''
    });

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    clusterId: editingItem.clusterId,
                    ipAddress: editingItem.ipAddress || '',
                    name: editingItem.name || '',
                    hdd: editingItem.hdd || '',
                    ram: editingItem.ram || '',
                    cpuCores: editingItem.cpuCores || '',
                    osVersion: editingItem.osVersion || '',
                    osType: editingItem.osType || '',
                    licenceExpiry: editingItem.licenceExpiry || ''
                });
            } else {
                setFormData({
                    clusterId: clusterId,
                    ipAddress: '',
                    name: '',
                    hdd: '',
                    ram: '',
                    cpuCores: '',
                    osVersion: '',
                    osType: '',
                    licenceExpiry: ''
                });
            }
        }
    }, [open, editingItem, clusterId]);

    const handleChange = (field: keyof CreateADDetailsPayload, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingItem) {
            const changedData: UpdateADDetailsPayload = {};
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.name !== editingItem.name) changedData.name = formData.name;
            if (formData.hdd !== editingItem.hdd) changedData.hdd = formData.hdd;
            if (formData.ram !== editingItem.ram) changedData.ram = formData.ram;
            if (formData.cpuCores !== editingItem.cpuCores) changedData.cpuCores = formData.cpuCores;
            if (formData.osVersion !== editingItem.osVersion) changedData.osVersion = formData.osVersion;
            if (formData.osType !== editingItem.osType) changedData.osType = formData.osType;
            if (formData.licenceExpiry !== editingItem.licenceExpiry) changedData.licenceExpiry = formData.licenceExpiry;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit AD Details' : 'Add AD Details'}
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.formGrid}>
                    <TextField 
                        label="IP Address" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ipAddress} 
                        onChange={(e) => handleChange('ipAddress', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="Name" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.name} 
                        onChange={(e) => handleChange('name', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="HDD" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.hdd} 
                        onChange={(e) => handleChange('hdd', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="RAM" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ram} 
                        onChange={(e) => handleChange('ram', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="CPU Cores" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.cpuCores} 
                        onChange={(e) => handleChange('cpuCores', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="OS Version" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.osVersion} 
                        onChange={(e) => handleChange('osVersion', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="OS Type" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.osType} 
                        onChange={(e) => handleChange('osType', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="Licence Expiry" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.licenceExpiry} 
                        onChange={(e) => handleChange('licenceExpiry', e.target.value)} 
                        required 
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

export default ADDetailsModal;
