import React, { useState, useEffect } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';
import { type NodeDetailsData, type CreateNodeDetailsPayload } from './model';
import request from '../../../services/request';
import styles from './modal.module.scss';

interface NodeDetailsModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    editingItem: NodeDetailsData | null;
    clusterId: string;
}

const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ open, onClose, onSubmit, editingItem, clusterId }) => {
    const [formData, setFormData] = useState<CreateNodeDetailsPayload>({
        clusterId: clusterId,
        slNumber: '',
        rack: '',
        hostName: '',
        ipAddress: '',
        serverModel: '',
        serialNumber: '',
        admin: '',
        adminCode: '',
        hypervisor: '',
        applications: '',
        clusterType: '',
        indentor: '',
        poNum: '',
        assetNum: '',
        custodian: '',
        redundancyPower: 'No',
        totalRam: undefined,
        totalHardisk: undefined,
        totalCpu: undefined,
        remarks: ''
    });

    const [users, setUsers] = useState<any[]>([]);
    const [racks, setRacks] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [hypervisors, setHypervisors] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            Promise.all([
                request.get('/api/users/', { params: { pagination: false } }).then(res => setUsers(res.data.data)),
                request.get('/api/server-racks/', { params: { pagination: false } }).then(res => setRacks(res.data.data)),
                request.get('/api/server-models/', { params: { pagination: false } }).then(res => setModels(res.data.data)),
                request.get('/api/hypervisors/', { params: { pagination: false } }).then(res => setHypervisors(res.data.data)),
                request.get('/api/cluster-types/', { params: { pagination: false } }).then(res => setClusters(res.data.data))
            ]).catch(e => console.error("Error fetching dropdown data", e));
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    clusterId: editingItem.clusterId || clusterId,
                    slNumber: editingItem.slNumber,
                    rack: editingItem.rack,
                    hostName: editingItem.hostName,
                    ipAddress: editingItem.ipAddress,
                    serverModel: editingItem.serverModel,
                    serialNumber: editingItem.serialNumber,
                    admin: editingItem.admin,
                    adminCode: editingItem.adminCode,
                    hypervisor: editingItem.hypervisor,
                    applications: editingItem.applications,
                    clusterType: editingItem.clusterType,
                    indentor: editingItem.indentor,
                    poNum: editingItem.poNum,
                    assetNum: editingItem.assetNum,
                    custodian: editingItem.custodian,
                    redundancyPower: editingItem.redundancyPower,
                    totalRam: editingItem.totalRam,
                    totalHardisk: editingItem.totalHardisk,
                    totalCpu: editingItem.totalCpu,
                    remarks: editingItem.remarks || ''
                });
            } else {
                setFormData({
                    clusterId: clusterId,
                    slNumber: '', rack: '', hostName: '', ipAddress: '', serverModel: '', serialNumber: '', admin: '',
                    adminCode: '', hypervisor: '', applications: '', clusterType: '', indentor: '', poNum: '', assetNum: '',
                    custodian: '', redundancyPower: 'No', totalRam: undefined, totalHardisk: undefined, totalCpu: undefined, remarks: ''
                });
            }
        }
    }, [open, editingItem, clusterId]);

    const handleChange = (field: keyof CreateNodeDetailsPayload, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'admin') {
                const u = users.find(u => u.username === value || (u.firstName + ' ' + u.lastName) === value || u._id === value);
                if (u) {
                    next.adminCode = u.passnumber || u.passNumber || '--';
                    next.admin = u.username;
                }
            }
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload = {
            ...formData,
            totalRam: formData.totalRam ? Number(formData.totalRam) : undefined,
            totalHardisk: formData.totalHardisk ? Number(formData.totalHardisk) : undefined,
            totalCpu: formData.totalCpu ? Number(formData.totalCpu) : undefined
        };

        if (editingItem) {
            onSubmit({ id: editingItem.id, ...payload });
        } else {
            onSubmit(payload);
        }
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Node Details' : 'Add Node Details'}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.formGrid}>
                    <Box>
                        <Dropdown
                            label="Rack"
                            value={formData.rack}
                            onChange={(val) => handleChange('rack', val)}
                            options={racks.map(r => ({ label: r.serverRack, value: r.serverRack }))}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField 
                            fullWidth 
                            label="Host Name" 
                            value={formData.hostName} 
                            onChange={(e) => handleChange('hostName', e.target.value)} 
                            required 
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth label="IP Address" value={formData.ipAddress} onChange={(e) => handleChange('ipAddress', e.target.value)} required />
                    </Box>
                    <Box>
                        <Dropdown
                            label="Server Model"
                            value={formData.serverModel}
                            onChange={(val) => handleChange('serverModel', val)}
                            options={models.map(m => ({ label: m.serverModel, value: m.serverModel }))}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Serial Number" value={formData.serialNumber} onChange={(e) => handleChange('serialNumber', e.target.value)} required />
                    </Box>
                    <Box>
                        <Dropdown
                            label="Admin"
                            value={formData.admin}
                            onChange={(val) => handleChange('admin', val)}
                            options={users.map(u => {
                                const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                                return { label: fullName || u.username, value: u.username };
                            })}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Admin Code" value={formData.adminCode} disabled placeholder="Auto-filled" />
                    </Box>
                    <Box>
                        <Dropdown
                            label="Hypervisor"
                            value={formData.hypervisor}
                            onChange={(val) => handleChange('hypervisor', val)}
                            options={hypervisors.map(h => ({ label: h.hypervisor, value: h.hypervisor }))}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Applications" value={formData.applications} onChange={(e) => handleChange('applications', e.target.value)} />
                    </Box>
                    <Box>
                        <Dropdown
                            label="Cluster Type"
                            value={formData.clusterType}
                            onChange={(val) => handleChange('clusterType', val)}
                            options={clusters.map(c => ({ label: c.clusterType, value: c.clusterType }))}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Indentor" value={formData.indentor} onChange={(e) => handleChange('indentor', e.target.value)} />
                    </Box>
                    <Box>
                        <TextField fullWidth label="PO Num" value={formData.poNum} onChange={(e) => handleChange('poNum', e.target.value)}  />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Asset Num" value={formData.assetNum} onChange={(e) => handleChange('assetNum', e.target.value)}  />
                    </Box>
                    <Box>
                        <TextField fullWidth label="Custodian" value={formData.custodian} onChange={(e) => handleChange('custodian', e.target.value)}  />
                    </Box>
                    <Box>
                        <Dropdown
                            label="Redundancy Power"
                            value={formData.redundancyPower}
                            onChange={(val) => handleChange('redundancyPower', val)}
                            options={[
                                { label: 'Yes', value: 'Yes' },
                                { label: 'No', value: 'No' }
                            ]}
                            required
                            fullWidth
                        />
                    </Box>
                    
                    <Box className={styles.formGrid__fullWidth}>
                        <Divider className={styles.formGrid__divider} />
                        <Typography variant="subtitle2" className={styles.formGrid__title}>
                            Resource Capacity Configuration
                        </Typography>
                        <Box className={styles.formGrid__resourceGrid}>
                            <TextField 
                                fullWidth
                                type="number" 
                                label="Total RAM (GB)" 
                                value={formData.totalRam ?? ''} 
                                onChange={(e) => handleChange('totalRam', e.target.value)} 
                            />
                            <TextField 
                                fullWidth
                                type="number" 
                                label="Total HDD (GB)" 
                                value={formData.totalHardisk ?? ''} 
                                onChange={(e) => handleChange('totalHardisk', e.target.value)} 
                            />
                            <TextField 
                                fullWidth
                                type="number" 
                                label="Total CPU (Cores)" 
                                value={formData.totalCpu ?? ''} 
                                onChange={(e) => handleChange('totalCpu', e.target.value)} 
                            />
                        </Box>
                    </Box>

                    <Box className={styles.formGrid__fullWidth}>
                        <TextField fullWidth multiline rows={2} label="Remarks" value={formData.remarks} onChange={(e) => handleChange('remarks', e.target.value)} />
                    </Box>
                </Box>
                <Box className={styles.buttonContainer}>
                    <Button variant="text" onClick={onClose} className={styles.buttonContainer__cancelBtn}>
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

export default NodeDetailsModal;
