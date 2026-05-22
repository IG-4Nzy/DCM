import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { type VCenterDetailsData, type CreateVCenterDetailsPayload, type UpdateVCenterDetailsPayload } from './model';

interface VCenterDetailsModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: VCenterDetailsData | null;
    clusterId: string;
}

const VCenterDetailsModal: React.FC<VCenterDetailsModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreateVCenterDetailsPayload>({
        clusterId: clusterId,
        ipAddress: '',
        name: '',
        hdd: '',
        ram: '',
        cpuCores: '',
        vcenterVersion: '',
        vcenterType: '',
        licenceExpiry: '',
        ha: '',
        drs: '',
        storage: '',
        portGroups: '',
        vmImageBackupLocation: ''
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
                    vcenterVersion: editingItem.vcenterVersion || '',
                    vcenterType: editingItem.vcenterType || '',
                    licenceExpiry: editingItem.licenceExpiry || '',
                    ha: editingItem.ha || '',
                    drs: editingItem.drs || '',
                    storage: editingItem.storage || '',
                    portGroups: editingItem.portGroups || '',
                    vmImageBackupLocation: editingItem.vmImageBackupLocation || ''
                });
            } else {
                setFormData({
                    clusterId: clusterId,
                    ipAddress: '',
                    name: '',
                    hdd: '',
                    ram: '',
                    cpuCores: '',
                    vcenterVersion: '',
                    vcenterType: '',
                    licenceExpiry: '',
                    ha: '',
                    drs: '',
                    storage: '',
                    portGroups: '',
                    vmImageBackupLocation: ''
                });
            }
        }
    }, [open, editingItem, clusterId]);

    const handleChange = (field: keyof CreateVCenterDetailsPayload, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingItem) {
            const changedData: UpdateVCenterDetailsPayload = {};
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.name !== editingItem.name) changedData.name = formData.name;
            if (formData.hdd !== editingItem.hdd) changedData.hdd = formData.hdd;
            if (formData.ram !== editingItem.ram) changedData.ram = formData.ram;
            if (formData.cpuCores !== editingItem.cpuCores) changedData.cpuCores = formData.cpuCores;
            if (formData.vcenterVersion !== editingItem.vcenterVersion) changedData.vcenterVersion = formData.vcenterVersion;
            if (formData.vcenterType !== editingItem.vcenterType) changedData.vcenterType = formData.vcenterType;
            if (formData.licenceExpiry !== editingItem.licenceExpiry) changedData.licenceExpiry = formData.licenceExpiry;
            if (formData.ha !== editingItem.ha) changedData.ha = formData.ha;
            if (formData.drs !== editingItem.drs) changedData.drs = formData.drs;
            if (formData.storage !== editingItem.storage) changedData.storage = formData.storage;
            if (formData.portGroups !== editingItem.portGroups) changedData.portGroups = formData.portGroups;
            if (formData.vmImageBackupLocation !== editingItem.vmImageBackupLocation) changedData.vmImageBackupLocation = formData.vmImageBackupLocation;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit vCenter Details' : 'Add vCenter Details'}
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mt: 1 }}>
                    <TextField 
                        label="IP Address" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.ipAddress} 
                        onChange={(e) => handleChange('ipAddress', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="Name" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.name} 
                        onChange={(e) => handleChange('name', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="HDD" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.hdd} 
                        onChange={(e) => handleChange('hdd', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="RAM" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.ram} 
                        onChange={(e) => handleChange('ram', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="CPU Cores" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.cpuCores} 
                        onChange={(e) => handleChange('cpuCores', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="vCenter Version" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.vcenterVersion} 
                        onChange={(e) => handleChange('vcenterVersion', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="vCenter Type" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.vcenterType} 
                        onChange={(e) => handleChange('vcenterType', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="Licence Expiry" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.licenceExpiry} 
                        onChange={(e) => handleChange('licenceExpiry', e.target.value)} 
                        required 
                    />
                    <Dropdown 
                        label="HA" 
                        size="small"
                        fullWidth
                        value={formData.ha} 
                        onChange={(val) => handleChange('ha', val)} 
                        options={[{label: 'ON', value: 'ON'}, {label: 'OFF', value: 'OFF'}]}
                        required 
                    />
                    <Dropdown 
                        label="DRS" 
                        size="small"
                        fullWidth
                        value={formData.drs} 
                        onChange={(val) => handleChange('drs', val)} 
                        options={[{label: 'ON', value: 'ON'}, {label: 'OFF', value: 'OFF'}]}
                        required 
                    />
                    <TextField 
                        label="Storage" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.storage} 
                        onChange={(e) => handleChange('storage', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="Port Groups" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.portGroups} 
                        onChange={(e) => handleChange('portGroups', e.target.value)} 
                        required 
                    />
                    <TextField 
                        label="VM Image Backup Location" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.vmImageBackupLocation} 
                        onChange={(e) => handleChange('vmImageBackupLocation', e.target.value)} 
                        required 
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                    <Button variant="outlined" onClick={onClose} sx={{ color: '#637381', borderColor: '#637381' }}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">{editingItem ? 'Update' : 'Submit'}</Button>
                </Box>
            </form>
        </Modal>
    );
};

export default VCenterDetailsModal;
