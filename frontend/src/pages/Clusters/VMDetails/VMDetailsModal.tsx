import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { type VMDetailsData, type CreateVMDetailsPayload, type UpdateVMDetailsPayload } from './model';
import { fetchAllNodes } from './action';

interface VMDetailsModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: VMDetailsData | null;
    clusterId: string;
}

const VMDetailsModal: React.FC<VMDetailsModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreateVMDetailsPayload>({
        clusterId: clusterId,
        ipAddress: '',
        applications: '',
        node: '',
        osAndExpiry: '',
        hdd: '',
        ram: '',
        cpu: ''
    });

    const [nodes, setNodes] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchAllNodes()
                .then(data => setNodes(data))
                .catch(err => console.error("Failed to load nodes", err));
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    clusterId: editingItem.clusterId,
                    ipAddress: editingItem.ipAddress || '',
                    applications: editingItem.applications || '',
                    node: editingItem.node || '',
                    osAndExpiry: editingItem.osAndExpiry || '',
                    hdd: editingItem.hdd || '',
                    ram: editingItem.ram || '',
                    cpu: editingItem.cpu || ''
                });
            } else {
                setFormData({
                    clusterId: clusterId,
                    ipAddress: '',
                    applications: '',
                    node: '',
                    osAndExpiry: '',
                    hdd: '',
                    ram: '',
                    cpu: ''
                });
            }
        }
    }, [open, editingItem, clusterId]);

    const handleChange = (field: keyof CreateVMDetailsPayload, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingItem) {
            const changedData: UpdateVMDetailsPayload = {};
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.applications !== editingItem.applications) changedData.applications = formData.applications;
            if (formData.node !== editingItem.node) changedData.node = formData.node;
            if (formData.osAndExpiry !== editingItem.osAndExpiry) changedData.osAndExpiry = formData.osAndExpiry;
            if (formData.hdd !== editingItem.hdd) changedData.hdd = formData.hdd;
            if (formData.ram !== editingItem.ram) changedData.ram = formData.ram;
            if (formData.cpu !== editingItem.cpu) changedData.cpu = formData.cpu;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit VM Details' : 'Add VM Details'}
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
                        label="Applications" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.applications} 
                        onChange={(e) => handleChange('applications', e.target.value)} 
                        required 
                    />
                    <Dropdown 
                        label="Node" 
                        size="small"
                        fullWidth
                        value={formData.node} 
                        onChange={(val) => handleChange('node', val)} 
                        options={nodes.map(n => ({ label: n.node, value: n.node }))}
                        required 
                    />
                    <TextField 
                        label="OS and Expiry" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.osAndExpiry} 
                        onChange={(e) => handleChange('osAndExpiry', e.target.value)} 
                        required 
                    />
                    
                    <Typography variant="subtitle1" sx={{ gridColumn: '1 / -1', mt: 2, fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1 }}>
                        Resource Allotter
                    </Typography>
                    
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
                        label="CPU" 
                        size="small"
                        sx={{ width: '100%' }}
                        value={formData.cpu} 
                        onChange={(e) => handleChange('cpu', e.target.value)} 
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

export default VMDetailsModal;
