// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Typography, Checkbox, FormControlLabel } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { fetchAllNodes } from './action';
import { fetchClusters } from '../action';
import request from '../../../services/request';
import styles from './modal.module.scss';

interface VMDetailsModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: VMDetailsData | null;
    clusterId: string;
}

const VMDetailsModal: React.FC<VMDetailsModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreateVMDetailsPayload>({
        vmId: '',
        vmName: '',
        clusterId: clusterId,
        ipAddress: '',
        applications: '',
        node: '',
        osAndExpiry: '',
        hdd: '',
        ram: '',
        cpu: '',
        backupLocation: '',
        adminName: '',
        adminContact: '',
        admin: [],
        powerStatus: 'on'
    });

    const [nodes, setNodes] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchAllNodes()
                .then(data => setNodes(data))
                .catch(err => console.error("Failed to load nodes", err));
            if (!clusterId || clusterId === '') {
                fetchClusters({ pagination: false })
                    .then(res => setClusters(res.data || []))
                    .catch(err => console.error("Failed to load clusters", err));
            }
            request.get('/api/users?pagination=false')
                .then(res => setUsers(res.data?.data || []))
                .catch(err => console.error("Failed to fetch users", err));
        }
    }, [open, clusterId]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    vmId: editingItem.vmId || '',
                    vmName: editingItem.vmName || '',
                    clusterId: editingItem.clusterId,
                    ipAddress: editingItem.ipAddress || '',
                    applications: editingItem.applications || '',
                    node: editingItem.node || '',
                    osAndExpiry: editingItem.osAndExpiry || '',
                    hdd: editingItem.hdd || '',
                    ram: editingItem.ram || '',
                    cpu: editingItem.cpu || '',
                    backupLocation: editingItem.backupLocation || '',
                    addedToMonitoring: editingItem.addedToMonitoring || false,
                    adminName: editingItem.adminName || '',
                    adminContact: editingItem.adminContact || '',
                    admin: Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []),
                    powerStatus: editingItem.powerStatus || 'on'
                });
            } else {
                setFormData({
                    vmId: '',
                    vmName: '',
                    clusterId: clusterId,
                    ipAddress: '',
                    applications: '',
                    node: '',
                    osAndExpiry: '',
                    hdd: '',
                    ram: '',
                    cpu: '',
                    backupLocation: '',
                    addedToMonitoring: false,
                    adminName: '',
                    adminContact: '',
                    admin: [],
                    powerStatus: 'on'
                });
            }
        }
    }, [open, editingItem, clusterId]);

    useEffect(() => {
        if (users.length > 0 && Array.isArray(formData.admin) && formData.admin.length > 0) {
            let changed = false;
            const updatedAdmin = formData.admin.map(adVal => {
                const foundUser = users.find(u => u.username === adVal || u._id === adVal || u.id === adVal);
                if (foundUser) {
                    const targetId = foundUser.id || foundUser._id;
                    if (targetId && adVal !== targetId) {
                        changed = true;
                        return targetId;
                    }
                }
                return adVal;
            });
            if (changed) {
                setFormData(prev => ({ ...prev, admin: updatedAdmin }));
            }
        }
    }, [users, formData.admin]);

    const handleChange = (field: keyof CreateVMDetailsPayload, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'admin') {
                const selectedIds = Array.isArray(value) ? value : [value];
                const selectedUsers = users.filter(u => selectedIds.includes(u._id || u.id));
                next.adminName = selectedUsers.map(u => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username).join(', ');
                next.adminContact = selectedUsers.map(u => u.mobile || u.phoneNumber || '').filter(Boolean).join(', ');
            }
            return next;
        });
    };

    const handleCheckboxChange = (field: keyof CreateVMDetailsPayload, checked: boolean) => {
        setFormData(prev => ({ ...prev, [field]: checked }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingItem) {
            const changedData: UpdateVMDetailsPayload = {};
            if (formData.vmName !== editingItem.vmName) changedData.vmName = formData.vmName;
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.applications !== editingItem.applications) changedData.applications = formData.applications;
            if (formData.node !== editingItem.node) changedData.node = formData.node;
            if (formData.osAndExpiry !== editingItem.osAndExpiry) changedData.osAndExpiry = formData.osAndExpiry;
            if (formData.hdd !== editingItem.hdd) changedData.hdd = formData.hdd;
            if (formData.ram !== editingItem.ram) changedData.ram = formData.ram;
            if (formData.cpu !== editingItem.cpu) changedData.cpu = formData.cpu;
            if (formData.backupLocation !== editingItem.backupLocation) changedData.backupLocation = formData.backupLocation;
            if (formData.addedToMonitoring !== editingItem.addedToMonitoring) changedData.addedToMonitoring = formData.addedToMonitoring;
            if (formData.adminName !== editingItem.adminName) changedData.adminName = formData.adminName;
            if (formData.adminContact !== editingItem.adminContact) changedData.adminContact = formData.adminContact;
            
            const oldAdmin = Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []);
            const newAdmin = Array.isArray(formData.admin) ? formData.admin : (formData.admin ? [formData.admin] : []);
            const adminChanged = oldAdmin.length !== newAdmin.length || oldAdmin.some((val, idx) => val !== newAdmin[idx]);
            if (adminChanged) changedData.admin = formData.admin;
            
            if (formData.powerStatus !== editingItem.powerStatus) changedData.powerStatus = formData.powerStatus;
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
                <Box className={styles.formGrid}>
                    {!!editingItem && (
                        <TextField 
                            label="VM ID" 
                            size="small"
                            className={styles.formGrid__field}
                            value={formData.vmId} 
                            onChange={(e) => handleChange('vmId', e.target.value)} 
                            disabled={true}
                        />
                    )}
                    <TextField 
                        label="VM Name" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.vmName} 
                        onChange={(e) => handleChange('vmName', e.target.value)} 
                    />
                    {(!clusterId || clusterId === '') && (
                        <Dropdown 
                            label="Cluster" 
                            size="small"
                            fullWidth
                            value={formData.clusterId} 
                            onChange={(val) => handleChange('clusterId', val)} 
                            options={clusters.map(c => ({ label: c.clusterName, value: c.id || c._id }))}
                        />
                    )}
                    <TextField 
                        label="IP Address" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ipAddress} 
                        onChange={(e) => handleChange('ipAddress', e.target.value)} 
                    />
                    <TextField 
                        label="Applications" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.applications} 
                        onChange={(e) => handleChange('applications', e.target.value)} 
                    />
                    <Dropdown 
                        label="Node" 
                        size="small"
                        fullWidth
                        value={formData.node} 
                        onChange={(val) => handleChange('node', val)} 
                        options={nodes
                            .filter(n => !formData.clusterId || n.clusterId === formData.clusterId)
                            .map(n => ({ label: n.node, value: n.node }))}
                    />
                    <TextField 
                        label="OS and Expiry" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.osAndExpiry} 
                        onChange={(e) => handleChange('osAndExpiry', e.target.value)} 
                    />
                    <TextField 
                        label="VM Backup Location" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.backupLocation} 
                        onChange={(e) => handleChange('backupLocation', e.target.value)} 
                    />
                    <Dropdown 
                        label="Power Status" 
                        size="small"
                        fullWidth
                        value={formData.powerStatus || 'on'} 
                        onChange={(val) => handleChange('powerStatus', val)} 
                        options={[
                            { label: 'On', value: 'on' },
                            { label: 'Off', value: 'off' }
                        ]}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                  checked={!!formData.addedToMonitoring}
                                onChange={(e) => handleCheckboxChange('addedToMonitoring', e.target.checked)}
                                color="primary"
                            />
                        }
                        label="VM added to monitoring confirmation"
                        className={styles.formGrid__field}
                    />

                    <Dropdown 
                        label="Admin" 
                        size="small"
                        fullWidth
                        searchable
                        multiple
                        value={formData.admin} 
                        onChange={(val) => handleChange('admin', val)} 
                        options={users.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username, value: u._id || u.id }))}
                    />
                    <TextField 
                        label="Admin Name (Auto-filled)" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.adminName} 
                        onChange={(e) => handleChange('adminName', e.target.value)} 
                        disabled
                    />
                    <TextField 
                        label="Admin Contact Number" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.adminContact} 
                        onChange={(e) => handleChange('adminContact', e.target.value)} 
                    />
                    
                    <Typography variant="subtitle1" className={styles.formGrid__title}>
                        Resource Allotter
                    </Typography>
                    
                    <TextField 
                        label="HDD" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.hdd} 
                        onChange={(e) => handleChange('hdd', e.target.value)} 
                    />
                    <TextField 
                        label="RAM" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ram} 
                        onChange={(e) => handleChange('ram', e.target.value)} 
                    />
                    <TextField 
                        label="CPU" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.cpu} 
                        onChange={(e) => handleChange('cpu', e.target.value)} 
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

export default VMDetailsModal;
