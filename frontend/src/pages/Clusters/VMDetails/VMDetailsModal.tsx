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
    const [datastores, setDatastores] = useState<any[]>([]);
    const [otherAdminName, setOtherAdminName] = useState<string>('');


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
            request.get('/api/datastores?pagination=false')
                .then(res => setDatastores(res.data?.data || []))
                .catch(err => console.error("Failed to fetch datastores", err));
        }
    }, [open, clusterId, editingItem]);

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
                    backupName: editingItem.backupName || '',
                    backupNode: editingItem.backupNode || '',
                    backupStorage: editingItem.backupStorage || '',
                    datastore: editingItem.datastore || '',
                    adminName: editingItem.adminName || '',
                    adminContact: editingItem.adminContact || '',
                    admin: Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []),
                    powerStatus: editingItem.powerStatus || 'on'
                });
                const adminArr = Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []);
                const customAdmins = adminArr.filter(a => a !== 'Other' && !users.some(u => (u._id || u.id || u.username) === a));
                if (customAdmins.length > 0) {
                    setOtherAdminName(customAdmins.join(', '));
                    if (!adminArr.includes('Other')) {
                        setFormData(prev => ({ ...prev, admin: [...adminArr.filter(a => users.some(u => (u._id || u.id || u.username) === a)), 'Other'] }));
                    }
                } else {
                    setOtherAdminName('');
                }
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
                    backupName: '',
                    backupNode: '',
                    backupStorage: '',
                    datastore: '',
                    adminName: '',
                    adminContact: '',
                    admin: [],
                    powerStatus: 'on'
                });
                setOtherAdminName('');
            }
        }
    }, [open, editingItem, clusterId]);

    useEffect(() => {
        if (users.length > 0 && Array.isArray(formData.admin) && formData.admin.length > 0) {
            let changed = false;
            const updatedAdmin = formData.admin.map(adVal => {
                if (adVal === 'Other') return adVal;
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
                const names = selectedUsers.map(u => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username);
                if (selectedIds.includes('Other') && otherAdminName.trim()) {
                    names.push(otherAdminName.trim());
                }
                next.adminName = names.join(', ');
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
        
        // Compute final admin array
        let currentAdmin: string[] = Array.isArray(formData.admin) ? formData.admin : [];
        if (currentAdmin.includes('Other')) {
            const withoutOther = currentAdmin.filter(a => a !== 'Other');
            currentAdmin = otherAdminName.trim() ? [...withoutOther, otherAdminName.trim()] : withoutOther;
        }

        if (editingItem) {
            const changedData: UpdateVMDetailsPayload = {};
            // Normalize undefined/null to empty string for comparison
            const norm = (v: any) => v ?? '';
            
            if (formData.vmName !== norm(editingItem.vmName)) changedData.vmName = formData.vmName;
            if (formData.clusterId !== norm(editingItem.clusterId)) changedData.clusterId = formData.clusterId;
            if (formData.ipAddress !== norm(editingItem.ipAddress)) changedData.ipAddress = formData.ipAddress;
            if (formData.applications !== norm(editingItem.applications)) changedData.applications = formData.applications;
            if (formData.node !== norm(editingItem.node)) changedData.node = formData.node;
            if (formData.osAndExpiry !== norm(editingItem.osAndExpiry)) changedData.osAndExpiry = formData.osAndExpiry;
            if (formData.hdd !== norm(editingItem.hdd)) changedData.hdd = formData.hdd;
            if (formData.ram !== norm(editingItem.ram)) changedData.ram = formData.ram;
            if (formData.cpu !== norm(editingItem.cpu)) changedData.cpu = formData.cpu;
            if (formData.backupName !== norm(editingItem.backupName)) changedData.backupName = formData.backupName;
            if (formData.backupNode !== norm(editingItem.backupNode)) changedData.backupNode = formData.backupNode;
            if (formData.backupStorage !== norm(editingItem.backupStorage)) changedData.backupStorage = formData.backupStorage;
            if (formData.datastore !== norm(editingItem.datastore)) changedData.datastore = formData.datastore;
            if (formData.adminName !== norm(editingItem.adminName)) changedData.adminName = formData.adminName;
            if (formData.adminContact !== norm(editingItem.adminContact)) changedData.adminContact = formData.adminContact;
            
            const oldAdmin = Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []);
            const adminChanged = oldAdmin.length !== currentAdmin.length || oldAdmin.some((val, idx) => val !== currentAdmin[idx]);
            if (adminChanged) changedData.admin = currentAdmin;
            
            if (formData.powerStatus !== norm(editingItem.powerStatus)) changedData.powerStatus = formData.powerStatus;
            onSubmit(changedData);
        } else {
            onSubmit({ ...formData, admin: currentAdmin });
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
                            searchable
                            value={formData.clusterId} 
                            onChange={(val) => {
                                setFormData(prev => ({ ...prev, clusterId: val, node: '' }));
                            }} 
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
                        searchable
                        value={formData.node} 
                        onChange={(val) => handleChange('node', val)} 
                        options={nodes
                            .filter(n => !formData.clusterId || n.clusterId === formData.clusterId || (n.clusterId && String(n.clusterId) === String(formData.clusterId)))
                            .map(n => {
                                const nodeName = n.node || n.hostName || n.nodeId || '';
                                const ip = n.ipAddress || n.ip || n.managementIp || '';
                                const label = ip ? `${nodeName} - ${ip}` : nodeName;
                                return { label, value: n.node || n.hostName || label };
                            })}
                    />
                    <TextField 
                        label="OS and Expiry" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.osAndExpiry} 
                        onChange={(e) => handleChange('osAndExpiry', e.target.value)} 
                    />
                    <TextField 
                        label="Backup Name" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.backupName} 
                        onChange={(e) => handleChange('backupName', e.target.value)} 
                    />
                    <Dropdown 
                        label="Backup Node" 
                        size="small"
                        fullWidth
                        searchable
                        value={formData.backupNode} 
                        onChange={(val) => handleChange('backupNode', val)} 
                        options={nodes.map(n => {
                            const nodeName = n.node || n.hostName || n.nodeId || '';
                            const ip = n.ipAddress || n.ip || n.managementIp || '';
                            const label = ip ? `${nodeName} - ${ip}` : nodeName;
                            return { label, value: n.node || n.hostName || label };
                        })}
                    />
                    <Dropdown 
                        label="Backup Storage" 
                        size="small"
                        fullWidth
                        searchable
                        value={formData.backupStorage} 
                        onChange={(val) => handleChange('backupStorage', val)} 
                        options={nodes.filter(n => n.type === 'storage' || n.isStorage).map(n => {
                            const nodeName = n.node || n.hostName || n.nodeId || '';
                            return { label: nodeName, value: nodeName };
                        })}
                    />
                    <Dropdown 
                        label="Datastore" 
                        size="small"
                        fullWidth
                        searchable
                        value={formData.datastore} 
                        onChange={(val) => handleChange('datastore', val)} 
                        options={datastores.map(d => ({ label: `${d.name} (${d.type} - ${d.capacity})`, value: d.name }))}
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

                    <Dropdown 
                        label="Admin" 
                        size="small"
                        fullWidth
                        searchable
                        multiple
                        value={formData.admin} 
                        onChange={(val) => handleChange('admin', val)} 
                        options={[
                            ...users.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username, value: u._id || u.id })),
                            { label: 'Other', value: 'Other' }
                        ]}
                    />
                    {Array.isArray(formData.admin) && formData.admin.includes('Other') && (
                        <TextField 
                            label="Other Admin Name" 
                            size="small"
                            className={styles.formGrid__field}
                            value={otherAdminName} 
                            onChange={(e) => {
                                setOtherAdminName(e.target.value);
                                const selectedUsers = users.filter(u => formData.admin.includes(u._id || u.id));
                                const names = selectedUsers.map(u => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username);
                                if (e.target.value.trim()) names.push(e.target.value.trim());
                                setFormData(prev => ({ ...prev, adminName: names.join(', ') }));
                            }} 
                            required
                        />
                    )}
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
