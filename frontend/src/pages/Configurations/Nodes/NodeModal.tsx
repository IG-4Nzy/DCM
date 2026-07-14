// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Grid, Checkbox, FormControlLabel, FormGroup, FormLabel } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { type NodeData, type CreateNodePayload, type UpdateNodePayload } from './model';
import { fetchServerRacks } from '../Racks/action';
import { fetchClusters } from '../../Clusters/action';
import { fetchServerModels } from '../ServerModels/action';
import request from '../../../services/request';

interface NodeModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateNodePayload | UpdateNodePayload) => void;
    editingItem: NodeData | null;
}

const NodeModal: React.FC<NodeModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [node, setField] = useState('');
    const [remarks, setRemarks] = useState('');
    const [totalRam, setTotalRam] = useState<string>('');
    const [totalHardisk, setTotalHardisk] = useState<string>('');
    const [totalCpu, setTotalCpu] = useState<string>('');
    const [rack, setRack] = useState('');
    const [rackPosition, setRackPosition] = useState('');
    const [rackUnits, setRackUnits] = useState('');
    const [clusterId, setClusterId] = useState('');
    const [serverModel, setServerModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [custodian, setCustodian] = useState('');
    const [admin, setAdmin] = useState('');
    const [assetNumber, setAssetNumber] = useState('');
    const [raidConfiguration, setRaidConfiguration] = useState<string[]>([]);
    
    const [racks, setRacks] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);
    const [serverModels, setServerModels] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchServerRacks({ pagination: false })
                .then(res => setRacks(res.data || []))
                .catch(err => console.error("Failed to fetch server racks", err));
            fetchClusters({ pagination: false })
                .then(res => setClusters(res.data || []))
                .catch(err => console.error("Failed to fetch clusters", err));
            fetchServerModels({ pagination: false })
                .then(res => setServerModels(res.data || []))
                .catch(err => console.error("Failed to fetch server models", err));
            request.get('/api/users?pagination=false')
                .then(res => setUsers(res.data?.data || []))
                .catch(err => console.error("Failed to fetch users", err));
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.node || '');
                setRemarks(editingItem.remarks || '');
                setTotalRam(editingItem.totalRam !== undefined && editingItem.totalRam !== null ? String(editingItem.totalRam) : '');
                setTotalHardisk(editingItem.totalHardisk !== undefined && editingItem.totalHardisk !== null ? String(editingItem.totalHardisk) : '');
                setTotalCpu(editingItem.totalCpu !== undefined && editingItem.totalCpu !== null ? String(editingItem.totalCpu) : '');
                setRack(editingItem.rack || '');
                setRackPosition(editingItem.rackPosition || '');
                setRackUnits(editingItem.rackUnits !== undefined && editingItem.rackUnits !== null ? String(editingItem.rackUnits) : '');
                setClusterId(editingItem.clusterId || '');
                setServerModel(editingItem.serverModel || '');
                setSerialNumber(editingItem.serialNumber || '');
                setCustodian(editingItem.custodian || '');
                setAdmin(editingItem.admin || '');
                setAssetNumber(editingItem.assetNumber || '');
                setRaidConfiguration(editingItem.raidConfiguration || []);
            } else {
                setField('');
                setRemarks('');
                setTotalRam('');
                setTotalHardisk('');
                setTotalCpu('');
                setRack('');
                setRackPosition('');
                setRackUnits('');
                setClusterId('');
                setServerModel('');
                setSerialNumber('');
                setCustodian('');
                setAdmin('');
                setAssetNumber('');
                setRaidConfiguration([]);
            }
        }
    }, [open, editingItem]);

    useEffect(() => {
        if (users.length > 0 && admin) {
            const foundUser = users.find(u => u.username === admin || u._id === admin || u.id === admin);
            if (foundUser) {
                const targetId = foundUser.id || foundUser._id;
                if (targetId && admin !== targetId) {
                    setAdmin(targetId);
                }
            }
        }
    }, [users, admin]);

    const handleRaidChange = (level: string, checked: boolean) => {
        if (checked) {
            setRaidConfiguration([...raidConfiguration, level]);
        } else {
            setRaidConfiguration(raidConfiguration.filter(r => r !== level));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload: any = {
            node: node.trim() ? node : undefined,
            remarks,
            totalRam: totalRam.trim() !== '' ? totalRam.trim() : undefined,
            totalHardisk: totalHardisk.trim() !== '' ? totalHardisk.trim() : undefined,
            totalCpu: totalCpu.trim() !== '' ? totalCpu.trim() : undefined,
            rack: rack || undefined,
            rackPosition: rackPosition || undefined,
            rackUnits: rackUnits.trim() !== '' ? Number(rackUnits) : undefined,
            clusterId: clusterId || undefined,
            serverModel: serverModel || undefined,
            serialNumber: serialNumber || undefined,
            custodian: custodian || undefined,
            admin: admin || undefined,
            assetNumber: assetNumber || undefined,
            raidConfiguration: raidConfiguration
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
            title={editingItem ? 'Edit Node' : 'Add Node'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <Dropdown
                        label="Cluster"
                        fullWidth
                        value={clusterId}
                        onChange={(val) => setClusterId(val)}
                        options={clusters.map(c => ({ label: c.clusterName, value: c.id }))}
                    />

                    <TextField
                        fullWidth
                        label="Node Name"
                        placeholder="e.g. Node-01"
                        value={node}
                        onChange={(e) => setField(e.target.value)}
                    />

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 6}}   >
                            <Dropdown
                                label="Server Model"
                                fullWidth
                                value={serverModel}
                                onChange={(val) => setServerModel(val)}
                                options={serverModels.map(sm => ({ label: sm.serverModel, value: sm.serverModel }))}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 6}}   >
                            <TextField
                                fullWidth
                                label="Serial Number"
                                placeholder="e.g. SN-12345"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Asset Number"
                                placeholder="e.g. AST-12345"
                                value={assetNumber}
                                onChange={(e) => setAssetNumber(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Custodian"
                                placeholder="e.g. John Doe"
                                value={custodian}
                                onChange={(e) => setCustodian(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <Dropdown
                                label="Admin"
                                fullWidth
                                searchable
                                value={admin}
                                onChange={(val) => setAdmin(val)}
                                options={users.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username, value: u._id || u.id }))}
                            />
                        </Grid>
                    </Grid>

                    <Box>
                        <FormLabel sx={{ display: 'block', mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                            RAID Configuration
                        </FormLabel>
                        <FormGroup row sx={{ gap: 1 }}>
                            {['RAID 0', 'RAID 1', 'RAID 5', 'RAID 6', 'RAID 10'].map((level) => (
                                <FormControlLabel
                                    key={level}
                                    control={
                                        <Checkbox
                                            checked={raidConfiguration.includes(level)}
                                            onChange={(e) => handleRaidChange(level, e.target.checked)}
                                        />
                                    }
                                    label={level}
                                />
                            ))}
                        </FormGroup>
                    </Box>
                    
                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Total RAM"
                                placeholder="e.g. 128"
                                value={totalRam}
                                onChange={(e) => setTotalRam(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Total HDD"
                                placeholder="e.g. 1000"
                                value={totalHardisk}
                                onChange={(e) => setTotalHardisk(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Total CPU"
                                placeholder="e.g. 32"
                                value={totalCpu}
                                onChange={(e) => setTotalCpu(e.target.value)}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <Dropdown
                                label="Server Rack"
                                fullWidth
                                value={rack}
                                onChange={(val) => setRack(val)}
                                options={racks.map(r => ({ label: r.serverRack, value: r.serverRack }))}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                label="Rack Position"
                                placeholder="e.g. U10"
                                value={rackPosition}
                                onChange={(e) => setRackPosition(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <TextField
                                fullWidth
                                type="number"
                                label="Rack Units (U)"
                                placeholder="e.g. 2"
                                value={rackUnits}
                                onChange={(e) => setRackUnits(e.target.value)}
                            />
                        </Grid>
                    </Grid>

                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Remarks"
                        placeholder="Enter remarks..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
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

export default NodeModal;
