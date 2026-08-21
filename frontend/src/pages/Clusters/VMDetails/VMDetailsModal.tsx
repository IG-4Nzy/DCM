// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Checkbox, FormControlLabel } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { fetchAllNodes } from './action';
import { fetchClusters } from '../action';
import request from '../../../services/request';
import { useSelector } from 'react-redux';
import { type RootState } from '../../../store';
import { hasPrivilege } from '../../../helpers/authUtils';
import { PRIVILEGES } from '../../../helpers/privileges';
import { validators } from '../../../helpers/validation';
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
    const [resolvedAdmins, setResolvedAdmins] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { isSuperuser, username } = useSelector((state: RootState) => state.auth);

    const isFullAdmin = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
    const isRestrictedAdmin = !isFullAdmin && !!editingItem && hasPrivilege(PRIVILEGES.UPDATE_VMS_RESTRICTED);

    const hasViewAll = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const currentUser = users.find(u => u.username === username);
    const userDept = currentUser?.department;

    const filteredUserOptions = users
        .filter(u => {
            if (hasViewAll) return true;
            return u.department === userDept;
        })
        .map(u => ({
            label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
            value: u._id || u.id
        }));

    const adminOptions = hasViewAll
        ? [
            ...filteredUserOptions,
            { label: 'Other', value: 'Other' }
        ]
        : filteredUserOptions;

    const restrictedAdminOptions = useMemo(() => {
        const currentUserName = currentUser ? (`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username) : username;
        const currentUserId = currentUser?._id || currentUser?.id || username;
        return [
            { label: 'Unassigned', value: 'unassigned' },
            { label: currentUserName, value: currentUserId }
        ];
    }, [currentUser, username]);

    useEffect(() => {
        if (open) {
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
            request.get('/api/datastores?pagination=false')
                .then(res => setDatastores(res.data?.data || []))
                .catch(err => console.error("Failed to fetch datastores", err));
        }
    }, [open, clusterId, editingItem, formData.clusterId]);

    useEffect(() => {
        if (open) {
            setErrors({});
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
                    powerStatus: editingItem.powerStatus || 'on',
                    isNetworkConnected: editingItem.isNetworkConnected !== undefined ? editingItem.isNetworkConnected : true,
                    networkType: editingItem.networkType || (editingItem.ipAddress?.startsWith('192.168') ? 'Internet' : editingItem.ipAddress?.startsWith('10.') ? 'Intranet' : 'Internet'),
                    clones: editingItem.clones || [],
                    snapshots: editingItem.snapshots || [],
                    templates: editingItem.templates || []
                });
                setOtherAdminName('');
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
                    powerStatus: 'on',
                    isNetworkConnected: true,
                    networkType: 'Internet',
                    clones: [],
                    snapshots: [],
                    templates: []
                });
                setOtherAdminName('');
            }
        }
    }, [open, editingItem, clusterId]);

    useEffect(() => {
        if (!open) {
            setResolvedAdmins(false);
        }
    }, [open]);

    useEffect(() => {
        if (open && users.length > 0 && !resolvedAdmins) {
            if (editingItem) {
                const adminArr = Array.isArray(editingItem.admin) ? editingItem.admin : (editingItem.admin ? [editingItem.admin] : []);
                const registeredAdmins = adminArr.filter(a => users.some(u => String(u._id || u.id || u.username) === String(a)));
                const customAdmins = adminArr.filter(a => a !== 'Other' && !users.some(u => String(u._id || u.id || u.username) === String(a)));

                let updatedAdminList = [...registeredAdmins];
                if (customAdmins.length > 0) {
                    setOtherAdminName(customAdmins.join(', '));
                    updatedAdminList.push('Other');
                } else {
                    setOtherAdminName('');
                }

                let finalAdminIds = updatedAdminList.map(adVal => {
                    if (adVal === 'Other') return adVal;
                    const foundUser = users.find(u => String(u.username) === String(adVal) || String(u._id) === String(adVal) || String(u.id) === String(adVal));
                    return foundUser ? (foundUser.id || foundUser._id) : adVal;
                });

                if (isRestrictedAdmin) {
                    const currentUserId = currentUser?._id || currentUser?.id || username;
                    const hasCurrentUser = finalAdminIds.some(id => id === currentUserId);
                    finalAdminIds = hasCurrentUser ? [currentUserId] : ['unassigned'];
                }

                setFormData(prev => ({
                    ...prev,
                    admin: finalAdminIds
                }));
                setResolvedAdmins(true);
            } else {
                setResolvedAdmins(true);
            }
        }
    }, [open, editingItem, users, resolvedAdmins, isRestrictedAdmin, currentUser, username]);

    const handleChange = (field: keyof CreateVMDetailsPayload, value: any) => {
        // Clear the error for this field on change
        setErrors(prev => ({ ...prev, [field]: '' }));
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'ipAddress') {
                const ipStr = String(value).trim();
                if (ipStr.startsWith('192.168.')) {
                    next.networkType = 'Internet';
                } else if (ipStr.startsWith('10.')) {
                    next.networkType = 'Intranet';
                }
            }
            if (field === 'admin') {
                let selectedIds = Array.isArray(value) ? value : [value];
                if (isRestrictedAdmin) {
                    const currentUserId = currentUser?._id || currentUser?.id || username;
                    if (selectedIds.includes('unassigned')) {
                        selectedIds = ['unassigned'];
                    } else if (selectedIds.length === 0) {
                        selectedIds = ['unassigned'];
                    } else {
                        selectedIds = selectedIds.filter(id => id === currentUserId);
                    }
                }
                const selectedUsers = users.filter(u => selectedIds.includes(u._id || u.id));
                const names = selectedUsers.map(u => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username);
                if (selectedIds.includes('Other') && otherAdminName.trim()) {
                    names.push(otherAdminName.trim());
                }
                next.adminName = names.join(', ');
                next.adminContact = selectedUsers.map(u => u.mobile || u.phoneNumber || '').filter(Boolean).join(', ');
                next.admin = selectedIds;
            }
            return next;
        });
    };

    const handleCheckboxChange = (field: keyof CreateVMDetailsPayload, checked: boolean) => {
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

    const backupNodeOptions = useMemo(() => {
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

        if (formData.backupNode && !list.some(opt => opt.value === formData.backupNode)) {
            list.unshift({ label: formData.backupNode, value: formData.backupNode });
        }

        return list;
    }, [nodes, formData.backupNode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // --- Validate all fields ---
        const vmNameErr = validators.alphanumericSpacesDotsDashesUnderscores(formData.vmName || '', 50, 'VM Name');
        const ipErr = validators.ipv4(formData.ipAddress || '', 'IP Address');
        const osErr = validators.osExpiry(formData.osAndExpiry || '', 100, 'OS and Expiry');
        const appsErr = validators.applicationsGeneral(formData.applications || '', 200, 'Applications');
        const backupNameErr = validators.alphanumericSpacesDotsDashesUnderscores(formData.backupName || '', 50, 'Backup Name');
        const hddErr = validators.alphanumeric(formData.hdd || '', 6, 'HDD');
        const ramErr = validators.alphanumeric(formData.ram || '', 6, 'RAM');
        const cpuErr = validators.alphanumeric(formData.cpu || '', 6, 'CPU');
        const contactErr = validators.phoneDigits(formData.adminContact || '', 50, 'Admin Contact');

        const newErrors = {
            vmName: vmNameErr,
            ipAddress: ipErr,
            osAndExpiry: osErr,
            applications: appsErr,
            backupName: backupNameErr,
            hdd: hddErr,
            ram: ramErr,
            cpu: cpuErr,
            adminContact: contactErr
        };
        setErrors(newErrors);
        if (Object.values(newErrors).some(err => !!err)) return;
        
        // Compute final admin array
        let currentAdmin: string[] = Array.isArray(formData.admin) ? formData.admin : [];
        if (currentAdmin.includes('Other')) {
            const withoutOther = currentAdmin.filter(a => a !== 'Other');
            currentAdmin = otherAdminName.trim() ? [...withoutOther, otherAdminName.trim()] : withoutOther;
        }
        if (currentAdmin.includes('unassigned')) {
            currentAdmin = currentAdmin.filter(a => a !== 'unassigned');
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
            if (formData.isNetworkConnected !== editingItem.isNetworkConnected) changedData.isNetworkConnected = formData.isNetworkConnected;
            if (formData.networkType !== norm(editingItem.networkType)) changedData.networkType = formData.networkType;

            changedData.clones = formData.clones;
            changedData.snapshots = formData.snapshots;
            changedData.templates = formData.templates;
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
                        disabled={isRestrictedAdmin}
                        error={!!errors.vmName}
                        helperText={errors.vmName}
                    />
                    {(!clusterId || clusterId === '') && (
                        <Dropdown 
                            label="Cluster" 
                            size="small"
                            fullWidth
                            searchable
                            clearable
                            disabled={isRestrictedAdmin}
                            value={formData.clusterId} 
                            onChange={(val) => handleChange('clusterId', val)} 
                            options={clusters.map((c) => ({ label: c.clusterName || c.id, value: c.id || c._id }))}
                        />
                    )}
                    <TextField 
                        label="IP Address" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ipAddress} 
                        onChange={(e) => handleChange('ipAddress', e.target.value)} 
                        disabled={isRestrictedAdmin}
                        error={!!errors.ipAddress}
                        helperText={errors.ipAddress}
                    />
                    <Dropdown 
                        label="Datastore" 
                        size="small"
                        fullWidth
                        searchable
                        clearable
                        disabled={isRestrictedAdmin}
                        value={formData.datastore} 
                        onChange={(val) => handleChange('datastore', val)} 
                        options={datastores.map((ds) => ({ label: `${ds.name || ds.datastoreName || ds.id}${ds.capacity ? ` (${ds.freeSpace || ''} free)` : ''}`, value: ds.name || ds.datastoreName || ds.id || ds._id }))}
                    />
                    <Dropdown 
                        label="Network Type" 
                        size="small"
                        fullWidth
                        disabled={isRestrictedAdmin}
                        value={formData.networkType || (formData.ipAddress?.startsWith('192.168') ? 'Internet' : formData.ipAddress?.startsWith('10.') ? 'Intranet' : 'Internet')} 
                        onChange={(val) => handleChange('networkType', val)} 
                        options={[
                            { label: 'Internet (192.168.x.x)', value: 'Internet' },
                            { label: 'Intranet (10.x.x.x)', value: 'Intranet' }
                        ]}
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
                        searchable
                        clearable
                        disabled={isRestrictedAdmin}
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
                        disabled={isRestrictedAdmin}
                        error={!!errors.osAndExpiry}
                        helperText={errors.osAndExpiry}
                    />
                    <TextField 
                        label="Backup Name" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.backupName} 
                        onChange={(e) => handleChange('backupName', e.target.value)} 
                        disabled={isRestrictedAdmin}
                        error={!!errors.backupName}
                        helperText={errors.backupName}
                    />
                    <Dropdown 
                        label="Backup Node" 
                        size="small"
                        fullWidth
                        searchable
                        clearable
                        disabled={isRestrictedAdmin}
                        value={formData.backupNode} 
                        onChange={(val) => handleChange('backupNode', val)} 
                        options={backupNodeOptions}
                    />
                    <Dropdown 
                        label="Backup Storage" 
                        size="small"
                        fullWidth
                        searchable
                        clearable
                        disabled={isRestrictedAdmin}
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
                        clearable
                        disabled={isRestrictedAdmin}
                        value={formData.datastore} 
                        onChange={(val) => handleChange('datastore', val)} 
                        options={datastores.map(d => ({ label: `${d.name} (${d.type} - ${d.capacity})`, value: d.name }))}
                    />
                    <Dropdown 
                        label="Power Status" 
                        size="small"
                        fullWidth
                        clearable
                        disabled={isRestrictedAdmin}
                        value={formData.powerStatus || 'on'} 
                        onChange={(val) => handleChange('powerStatus', val)} 
                        options={[
                            { label: 'On', value: 'on' },
                            { label: 'Off', value: 'off' }
                        ]}
                    />
                    <Dropdown 
                        label="Network Connection" 
                        size="small"
                        fullWidth
                        clearable
                        disabled={isRestrictedAdmin}
                        value={formData.isNetworkConnected !== false ? 'connected' : 'disconnected'} 
                        onChange={(val) => handleChange('isNetworkConnected', val === 'connected')} 
                        options={[
                            { label: 'Connected', value: 'connected' },
                            { label: 'Disconnected', value: 'disconnected' }
                        ]}
                    />

                    <Dropdown 
                        label="Admin" 
                        size="small"
                        fullWidth
                        searchable
                        clearable
                        multiple
                        disabled={!isFullAdmin && !isRestrictedAdmin}
                        value={formData.admin} 
                        onChange={(val) => handleChange('admin', val)} 
                        options={isRestrictedAdmin ? restrictedAdminOptions : adminOptions}
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
                            disabled={isRestrictedAdmin}
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
                        error={!!errors.adminContact}
                        helperText={errors.adminContact}
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
                        disabled={isRestrictedAdmin}
                        error={!!errors.hdd}
                        helperText={errors.hdd}
                    />
                    <TextField 
                        label="RAM" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.ram} 
                        onChange={(e) => handleChange('ram', e.target.value)} 
                        disabled={isRestrictedAdmin}
                        error={!!errors.ram}
                        helperText={errors.ram}
                    />
                    <TextField 
                        label="CPU" 
                        size="small"
                        className={styles.formGrid__field}
                        value={formData.cpu} 
                        onChange={(e) => handleChange('cpu', e.target.value)} 
                        disabled={isRestrictedAdmin}
                        error={!!errors.cpu}
                        helperText={errors.cpu}
                    />

                    {/* Clones Section */}
                    <Typography variant="subtitle1" className={styles.formGrid__title}>
                        Clones
                    </Typography>
                    <Box sx={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(formData.clones || []).map((clone, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField 
                                    label="Clone Name" 
                                    size="small" 
                                    sx={{ flex: 1 }}
                                    value={clone.name} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.clones || [])];
                                        updated[idx].name = e.target.value;
                                        setFormData(prev => ({ ...prev, clones: updated }));
                                    }}
                                />
                                <TextField 
                                    label="Remarks" 
                                    size="small" 
                                    sx={{ flex: 2 }}
                                    value={clone.remarks || ''} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.clones || [])];
                                        updated[idx].remarks = e.target.value;
                                        setFormData(prev => ({ ...prev, clones: updated }));
                                    }}
                                />
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small"
                                    disabled={isRestrictedAdmin}
                                    onClick={() => {
                                        const updated = (formData.clones || []).filter((_, i) => i !== idx);
                                        setFormData(prev => ({ ...prev, clones: updated }));
                                    }}
                                >
                                    Delete
                                </Button>
                            </Box>
                        ))}
                        <Button 
                            variant="outlined" 
                            size="small" 
                            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                            disabled={isRestrictedAdmin}
                            onClick={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    clones: [...(prev.clones || []), { name: '', remarks: '' }]
                                }));
                            }}
                        >
                            + Add Clone
                        </Button>
                    </Box>

                    {/* Snapshots Section */}
                    <Typography variant="subtitle1" className={styles.formGrid__title}>
                        Snapshots
                    </Typography>
                    <Box sx={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(formData.snapshots || []).map((snap, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField 
                                    label="Snapshot Name" 
                                    size="small" 
                                    sx={{ flex: 1 }}
                                    value={snap.name} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.snapshots || [])];
                                        updated[idx].name = e.target.value;
                                        setFormData(prev => ({ ...prev, snapshots: updated }));
                                    }}
                                />
                                <TextField 
                                    label="Remarks" 
                                    size="small" 
                                    sx={{ flex: 2 }}
                                    value={snap.remarks || ''} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.snapshots || [])];
                                        updated[idx].remarks = e.target.value;
                                        setFormData(prev => ({ ...prev, snapshots: updated }));
                                    }}
                                />
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small"
                                    disabled={isRestrictedAdmin}
                                    onClick={() => {
                                        const updated = (formData.snapshots || []).filter((_, i) => i !== idx);
                                        setFormData(prev => ({ ...prev, snapshots: updated }));
                                    }}
                                >
                                    Delete
                                </Button>
                            </Box>
                        ))}
                        <Button 
                            variant="outlined" 
                            size="small" 
                            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                            disabled={isRestrictedAdmin}
                            onClick={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    snapshots: [...(prev.snapshots || []), { name: '', remarks: '' }]
                                }));
                            }}
                        >
                            + Add Snapshot
                        </Button>
                    </Box>

                    {/* Templates Section */}
                    <Typography variant="subtitle1" className={styles.formGrid__title}>
                        Templates
                    </Typography>
                    <Box sx={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(formData.templates || []).map((tpl, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField 
                                    label="Template Name" 
                                    size="small" 
                                    sx={{ flex: 1 }}
                                    value={tpl.name} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.templates || [])];
                                        updated[idx].name = e.target.value;
                                        setFormData(prev => ({ ...prev, templates: updated }));
                                    }}
                                />
                                <TextField 
                                    label="Remarks" 
                                    size="small" 
                                    sx={{ flex: 2 }}
                                    value={tpl.remarks || ''} 
                                    disabled={isRestrictedAdmin}
                                    onChange={(e) => {
                                        const updated = [...(formData.templates || [])];
                                        updated[idx].remarks = e.target.value;
                                        setFormData(prev => ({ ...prev, templates: updated }));
                                    }}
                                />
                                <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small"
                                    disabled={isRestrictedAdmin}
                                    onClick={() => {
                                        const updated = (formData.templates || []).filter((_, i) => i !== idx);
                                        setFormData(prev => ({ ...prev, templates: updated }));
                                    }}
                                >
                                    Delete
                                </Button>
                            </Box>
                        ))}
                        <Button 
                            variant="outlined" 
                            size="small" 
                            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                            disabled={isRestrictedAdmin}
                            onClick={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    templates: [...(prev.templates || []), { name: '', remarks: '' }]
                                }));
                            }}
                        >
                            + Add Template
                        </Button>
                    </Box>
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
