import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';
import { type NodeDetailsData, type CreateNodeDetailsPayload, type UpdateNodeDetailsPayload } from './model';
import request from '../../../services/request';

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
        remarks: ''
    });

    const [users, setUsers] = useState<any[]>([]);
    const [racks, setRacks] = useState<any[]>([]);
    const [nodes, setNodes] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [hypervisors, setHypervisors] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            Promise.all([
                request.get('/api/users/', { params: { pagination: false } }).then(res => setUsers(res.data.data)),
                request.get('/api/server-racks/', { params: { pagination: false } }).then(res => setRacks(res.data.data)),
                request.get('/api/nodes/', { params: { pagination: false } }).then(res => setNodes(res.data.data)),
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
                    remarks: editingItem.remarks || ''
                });
            } else {
                setFormData({
                    clusterId: clusterId,
                    slNumber: '', rack: '', hostName: '', ipAddress: '', serverModel: '', serialNumber: '', admin: '',
                    adminCode: '', hypervisor: '', applications: '', clusterType: '', indentor: '', poNum: '', assetNum: '',
                    custodian: '', redundancyPower: 'No', remarks: ''
                });
            }
        }
    }, [open, editingItem]);

    const handleChange = (field: keyof CreateNodeDetailsPayload, value: string) => {
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
        
        if (editingItem) {
            onSubmit({ id: editingItem.id, ...formData });
        } else {
            onSubmit(formData);
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
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 3, mt: 1 }}>

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
                        <Dropdown
                            label="Host Name"
                            value={formData.hostName}
                            onChange={(val) => handleChange('hostName', val)}
                            options={nodes.map(n => ({ label: n.node, value: n.node }))}
                            required
                            fullWidth
                        />
                    </Box>
                    <Box>
                        <TextField fullWidth sx={{ width: '100%' }} label="IP Address" value={formData.ipAddress} onChange={(e) => handleChange('ipAddress', e.target.value)} required />
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
                        <TextField fullWidth sx={{ width: '100%' }} label="Serial Number" value={formData.serialNumber} onChange={(e) => handleChange('serialNumber', e.target.value)} required />
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
                        <TextField fullWidth sx={{ width: '100%' }} label="Admin Code" value={formData.adminCode} disabled placeholder="Auto-filled" />
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
                        <TextField fullWidth sx={{ width: '100%' }} label="Applications" value={formData.applications} onChange={(e) => handleChange('applications', e.target.value)} />
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
                        <TextField fullWidth sx={{ width: '100%' }} label="Indentor" value={formData.indentor} onChange={(e) => handleChange('indentor', e.target.value)} />
                    </Box>
                    <Box>
                        <TextField fullWidth sx={{ width: '100%' }} label="PO Num" value={formData.poNum} onChange={(e) => handleChange('poNum', e.target.value)}  />
                    </Box>
                    <Box>
                        <TextField fullWidth sx={{ width: '100%' }} label="Asset Num" value={formData.assetNum} onChange={(e) => handleChange('assetNum', e.target.value)}  />
                    </Box>
                    <Box>
                        <TextField fullWidth sx={{ width: '100%' }} label="Custodian" value={formData.custodian} onChange={(e) => handleChange('custodian', e.target.value)}  />
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
                    <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                        <TextField fullWidth sx={{ width: '100%' }} multiline rows={2} label="Remarks" value={formData.remarks} onChange={(e) => handleChange('remarks', e.target.value)} />
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

export default NodeDetailsModal;
