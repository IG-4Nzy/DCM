// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Checkbox, FormControlLabel } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { fetchAllNodes } from './action';
import { fetchClusters } from '../../Clusters/action';
import request from '../../../services/request';
import { validators } from '../../../helpers/validation';
import styles from './modal.module.scss';

interface PhysicalServerModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: PhysicalServerData | null;
    clusterId: string;
}

const PhysicalServerModal: React.FC<PhysicalServerModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreatePhysicalServerPayload>({
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
        admin: []
    });

    const [nodes, setNodes] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setErrors({});
            const activeClusterId = editingItem ? editingItem.clusterId : (formData.clusterId || clusterId);
            const nodeParams: any = {};
            if (activeClusterId) {
                nodeParams.clusterId = activeClusterId;
            }
            fetchAllNodes(nodeParams)
                .then(data => setNodes(data || []))
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
    }, [open, clusterId, editingItem, formData.clusterId]);

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
                    cpu: editingItem.cpu || '',
                    backupLocation: editingItem.backupLocation || '',
                    addedToMonitoring: editingItem.addedToMonitoring || false,
                    admin: Array.isArray(editingItem.admin)
                        ? editingItem.admin
                        : (editingItem.admin ? [editingItem.admin] : [])
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
                    cpu: '',
                    backupLocation: '',
                    addedToMonitoring: false,
                    admin: []
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

    const validateField = (field: string, value: string) => {
        let errMsg = '';
        if (field === 'ipAddress') {
            errMsg = validators.ipv4(value, 'IP Address');
        } else if (field === 'applications') {
            errMsg = validators.alphanumericGeneral(value, 100, 'Applications');
        } else if (field === 'osAndExpiry') {
            errMsg = validators.alphanumericGeneral(value, 100, 'OS and Expiry');
        } else if (field === 'backupLocation') {
            errMsg = validators.alphanumericGeneral(value, 100, 'Server Backup Location');
        } else if (field === 'hdd') {
            errMsg = validators.alphanumericGeneral(value, 100, 'HDD');
        } else if (field === 'ram') {
            errMsg = validators.alphanumericGeneral(value, 100, 'RAM');
        } else if (field === 'cpu') {
            errMsg = validators.alphanumericGeneral(value, 100, 'CPU');
        }
        setErrors(prev => ({ ...prev, [field]: errMsg }));
        return errMsg;
    };

    const handleChange = (field: keyof CreatePhysicalServerPayload, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (typeof value === 'string') {
            validateField(field, value);
        }
    };

    const handleCheckboxChange = (field: keyof CreatePhysicalServerPayload, checked: boolean) => {
        setFormData(prev => ({ ...prev, [field]: checked }));
    };

    const nodeOptions = useMemo(() => {
        const list: { label: string; value: string }[] = [];
        const usedValues = new Set<string>();

        (nodes || []).forEach((n, idx) => {
            const rawNodeName = n.node || n.hostName || n.nodeId || n.name || '';
            const ip = n.ipAddress || n.ip || n.managementIp || '';
            const fallbackName = ip ? `Node ${ip}` : `Node ${n._id || n.id || idx + 1}`;
            const baseName = rawNodeName || fallbackName;
            const label = ip && !baseName.includes(ip) ? `${baseName} - ${ip}` : baseName;

            let val = baseName;
            if (usedValues.has(val)) {
                val = label;
            }
            if (usedValues.has(val)) {
                val = `${label} (${n.nodeId || n._id || idx + 1})`;
            }
            usedValues.add(val);
            list.push({ label, value: val });
        });

        if (formData.node && !list.some(opt => opt.value === formData.node)) {
            list.unshift({ label: formData.node, value: formData.node });
        }

        return list;
    }, [nodes, formData.node]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const ipErr = validators.ipv4(formData.ipAddress, 'IP Address');
        const appErr = validators.alphanumericGeneral(formData.applications, 100, 'Applications');
        const osErr = validators.alphanumericGeneral(formData.osAndExpiry, 100, 'OS and Expiry');
        const backErr = validators.alphanumericGeneral(formData.backupLocation, 100, 'Server Backup Location');
        const hddErr = validators.alphanumericGeneral(formData.hdd, 100, 'HDD');
        const ramErr = validators.alphanumericGeneral(formData.ram, 100, 'RAM');
        const cpuErr = validators.alphanumericGeneral(formData.cpu, 100, 'CPU');

        const newErrors = {
            ipAddress: ipErr,
            applications: appErr,
            osAndExpiry: osErr,
            backupLocation: backErr,
            hdd: hddErr,
            ram: ramErr,
            cpu: cpuErr
        };

        setErrors(newErrors);

        if (Object.values(newErrors).some(err => !!err)) {
            return;
        }
        
        if (editingItem) {
            const changedData: UpdatePhysicalServerPayload = {};
            if (formData.clusterId !== editingItem.clusterId) changedData.clusterId = formData.clusterId;
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.applications !== editingItem.applications) changedData.applications = formData.applications;
            if (formData.node !== editingItem.node) changedData.node = formData.node;
            if (formData.osAndExpiry !== editingItem.osAndExpiry) changedData.osAndExpiry = formData.osAndExpiry;
            if (formData.hdd !== editingItem.hdd) changedData.hdd = formData.hdd;
            if (formData.ram !== editingItem.ram) changedData.ram = formData.ram;
            if (formData.cpu !== editingItem.cpu) changedData.cpu = formData.cpu;
            if (formData.backupLocation !== editingItem.backupLocation) changedData.backupLocation = formData.backupLocation;
            if (formData.addedToMonitoring !== editingItem.addedToMonitoring) changedData.addedToMonitoring = formData.addedToMonitoring;
            const origAdmin = Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []);
            const newAdmin = Array.isArray(formData.admin) ? formData.admin : (formData.admin ? [formData.admin] : []);
            if (JSON.stringify(origAdmin.sort()) !== JSON.stringify(newAdmin.sort())) changedData.admin = formData.admin;
            onSubmit(changedData);
        } else {
            onSubmit(formData);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Physical Server Details' : 'Add Physical Server Details'}
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.formGrid}>
                    {(!clusterId || clusterId === '') && (
                        <Dropdown 
                            label="Cluster" 
                            size="small"
                            fullWidth
                            value={formData.clusterId} 
                            onChange={(val) => handleChange('clusterId', val)} 
                            options={clusters.map(c => ({ label: c.clusterName, value: c.id }))}
                        />
                    )}
                    <TextField 
                        label="IP Address" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ipAddress} 
                        onChange={(e) => handleChange('ipAddress', e.target.value)} 
                        error={!!errors.ipAddress}
                        helperText={errors.ipAddress}
                    />
                    <TextField 
                        label="Applications" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.applications} 
                        onChange={(e) => handleChange('applications', e.target.value)} 
                        error={!!errors.applications}
                        helperText={errors.applications}
                    />
                    <Dropdown 
                        label="Node" 
                        size="small"
                        fullWidth
                        value={formData.node} 
                        onChange={(val) => handleChange('node', val)} 
                        options={nodeOptions}
                    />
                    <TextField 
                        label="OS and Expiry" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.osAndExpiry} 
                        onChange={(e) => handleChange('osAndExpiry', e.target.value)} 
                        error={!!errors.osAndExpiry}
                        helperText={errors.osAndExpiry}
                    />
                    <TextField 
                        label="Server Backup Location" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.backupLocation} 
                        onChange={(e) => handleChange('backupLocation', e.target.value)} 
                        error={!!errors.backupLocation}
                        helperText={errors.backupLocation}
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
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!formData.addedToMonitoring}
                                onChange={(e) => handleCheckboxChange('addedToMonitoring', e.target.checked)}
                                color="primary"
                            />
                        }
                        label="Server added to monitoring confirmation"
                        className={styles.formGrid__field}
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
                        error={!!errors.hdd}
                        helperText={errors.hdd}
                    />
                    <TextField 
                        label="RAM" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ram} 
                        onChange={(e) => handleChange('ram', e.target.value)} 
                        error={!!errors.ram}
                        helperText={errors.ram}
                    />
                    <TextField 
                        label="CPU" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.cpu} 
                        onChange={(e) => handleChange('cpu', e.target.value)} 
                        error={!!errors.cpu}
                        helperText={errors.cpu}
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

export default PhysicalServerModal;
