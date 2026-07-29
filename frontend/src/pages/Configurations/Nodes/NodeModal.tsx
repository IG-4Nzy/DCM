// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Grid, Checkbox, FormControlLabel, FormGroup, FormLabel, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { MdAdd as AddIcon } from 'react-icons/md';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { type NodeData, type CreateNodePayload, type UpdateNodePayload } from './model';
import { fetchServerRacks } from '../Racks/action';
import { fetchServerModels, createServerModel } from '../ServerModels/action';
import request from '../../../services/request';

const matchesPosition = (nodeRackPosition: string | undefined, posIndex: number) => {
    if (!nodeRackPosition) return false;
    const parts = nodeRackPosition.split(',').map(p => p.trim().toLowerCase());
    const pad2 = String(posIndex).padStart(2, '0');
    return parts.some(norm =>
        norm === `m ${posIndex}` || 
        norm === `m${posIndex}` || 
        norm === `m-${posIndex}` || 
        norm === `m ${pad2}` || 
        norm === `m${pad2}` || 
        norm === `m-${pad2}` || 
        norm === `${posIndex}` || 
        norm === pad2
    );
};

interface NodeModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateNodePayload | UpdateNodePayload) => void;
    editingItem: NodeData | null;
    activeRackFilter?: string;
}

const NodeModal: React.FC<NodeModalProps> = ({ open, onClose, onSubmit, editingItem, activeRackFilter }) => {
    const [node, setField] = useState('');
    const [ip, setIp] = useState('');
    const [remarks, setRemarks] = useState('');
    const [totalRam, setTotalRam] = useState<string>('');
    const [totalHardisk, setTotalHardisk] = useState<string>('');
    const [totalCpu, setTotalCpu] = useState<string>('');
    const [rack, setRack] = useState('');
    const [rackPosition, setRackPosition] = useState<string[]>([]);
    const [rackUnits, setRackUnits] = useState('');
    const [serverModel, setServerModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [custodian, setCustodian] = useState('');
    const [admin, setAdmin] = useState<string[]>([]);
    const [otherAdminName, setOtherAdminName] = useState<string>('');
    const [assetNumber, setAssetNumber] = useState('');
    const [raidConfiguration, setRaidConfiguration] = useState<string[]>([]);
    const [nodeType, setNodeType] = useState<'node' | 'appliance' | 'storage'>('node');
    const [isPhysical, setIsPhysical] = useState<boolean>(false);
    const [os, setOs] = useState<string>('');
    const [gpu, setGpu] = useState<string>('');
    
    const [racks, setRacks] = useState<any[]>([]);
    const [serverModels, setServerModels] = useState<any[]>([]);
    const [gpusList, setGpusList] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [allNodes, setAllNodes] = useState<any[]>([]);

    const [showNewModelModal, setShowNewModelModal] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [newModelRemarks, setNewModelRemarks] = useState('');

    useEffect(() => {
        if (open) {
            fetchServerRacks({ pagination: false })
                .then(res => setRacks(res.data || []))
                .catch(err => console.error("Failed to fetch server racks", err));
            fetchServerModels({ pagination: false })
                .then(res => setServerModels(res.data || []))
                .catch(err => console.error("Failed to fetch server models", err));
            request.get('/api/gpus?pagination=false')
                .then(res => setGpusList(res.data?.data || []))
                .catch(err => console.error("Failed to fetch GPUs", err));
            request.get('/api/users?pagination=false')
                .then(res => setUsers(res.data?.data || []))
                .catch(err => console.error("Failed to fetch users", err));
            request.get('/api/nodes?pagination=false')
                .then(res => setAllNodes(res.data?.data || []))
                .catch(err => console.error("Failed to fetch nodes", err));
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setField(editingItem.node || '');
                setIp(editingItem.ip || '');
                setRemarks(editingItem.remarks || '');
                setTotalRam(editingItem.totalRam !== undefined && editingItem.totalRam !== null ? String(editingItem.totalRam) : '');
                setTotalHardisk(editingItem.totalHardisk !== undefined && editingItem.totalHardisk !== null ? String(editingItem.totalHardisk) : '');
                setTotalCpu(editingItem.totalCpu !== undefined && editingItem.totalCpu !== null ? String(editingItem.totalCpu) : '');
                setRack(editingItem.rack || '');
                setRackPosition(
                    editingItem.rackPosition
                        ? editingItem.rackPosition.split(',').map(p => p.trim())
                        : []
                );
                setRackUnits(editingItem.rackUnits !== undefined && editingItem.rackUnits !== null ? String(editingItem.rackUnits) : '');
                setServerModel(editingItem.serverModel || '');
                setSerialNumber(editingItem.serialNumber || '');
                setCustodian(editingItem.custodian || '');
                const adminArr = Array.isArray(editingItem.admin)
                    ? editingItem.admin
                    : (editingItem.admin ? [editingItem.admin] : []);
                setAdmin(adminArr);
                if (users.length > 0) {
                    const customAdmins = adminArr.filter(a => a !== 'Other' && !users.some(u => (u._id === a || u.id === a || u.username === a)));
                    if (customAdmins.length > 0) {
                        setOtherAdminName(customAdmins.join(', '));
                        setAdmin([...adminArr.filter(a => users.some(u => (u._id === a || u.id === a || u.username === a))), 'Other']);
                    } else {
                        setOtherAdminName('');
                    }
                } else {
                    setOtherAdminName('');
                }
                setAssetNumber(editingItem.assetNumber || '');
                setRaidConfiguration(editingItem.raidConfiguration || []);
                if (editingItem.isStorage) {
                    setNodeType('storage');
                } else if (editingItem.isAppliance) {
                    setNodeType('appliance');
                } else {
                    setNodeType('node');
                }
                setIsPhysical(editingItem.isPhysical || false);
                setOs(editingItem.os || '');
                setGpu(editingItem.gpu || '');
            } else {
                setField('');
                setIp('');
                setRemarks('');
                setTotalRam('');
                setTotalHardisk('');
                setTotalCpu('');
                setRack(activeRackFilter || '');
                setRackPosition([]);
                setRackUnits('');
                setServerModel('');
                setSerialNumber('');
                setCustodian('');
                setAdmin([]);
                setOtherAdminName('');
                setAssetNumber('');
                setRaidConfiguration([]);
                setNodeType('node');
                setIsPhysical(false);
                setOs('');
                setGpu('');
            }
        }
    }, [open, editingItem, activeRackFilter, users]);

    useEffect(() => {
        if (users.length > 0 && Array.isArray(admin) && admin.length > 0) {
            let changed = false;
            const updatedAdmin = admin.map(adVal => {
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
                setAdmin(updatedAdmin);
            }
        }
    }, [users, admin]);

    useEffect(() => {
        if (Array.isArray(rackPosition) && rackPosition.length > 0) {
            setRackUnits(String(rackPosition.length));
        }
    }, [rackPosition]);

    const handleRaidChange = (level: string, checked: boolean) => {
        if (checked) {
            setRaidConfiguration([...raidConfiguration, level]);
        } else {
            setRaidConfiguration(raidConfiguration.filter(r => r !== level));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const computedRackUnits = rackUnits.trim() !== '' 
            ? Number(rackUnits) 
            : (rackPosition && rackPosition.length > 0 ? rackPosition.length : undefined);

        // Compute final admin array including custom admin name if 'Other' selected
        let finalAdmin: string[] | undefined = undefined;
        if (admin && admin.length > 0) {
            const listWithoutOther = admin.filter(a => a !== 'Other');
            if (admin.includes('Other') && otherAdminName.trim()) {
                finalAdmin = [...listWithoutOther, otherAdminName.trim()];
            } else {
                finalAdmin = listWithoutOther.length > 0 ? listWithoutOther : undefined;
            }
        }

        const payload: any = {
            node: node.trim() ? node : '',
            ip: ip.trim() ? ip : '',
            remarks: remarks || '',
            totalRam: totalRam.trim() !== '' ? totalRam.trim() : '',
            totalHardisk: totalHardisk.trim() !== '' ? totalHardisk.trim() : '',
            totalCpu: totalCpu.trim() !== '' ? totalCpu.trim() : '',
            rack: rack || '',
            rackPosition: rackPosition && rackPosition.length > 0 ? rackPosition.join(', ') : '',
            rackUnits: computedRackUnits !== undefined ? computedRackUnits : '',
            serverModel: serverModel || '',
            serialNumber: serialNumber || '',
            custodian: custodian || '',
            admin: finalAdmin || [],
            assetNumber: assetNumber || '',
            raidConfiguration: raidConfiguration,
            isAppliance: nodeType === 'appliance',
            isStorage: nodeType === 'storage',
            isPhysical: nodeType === 'node' ? isPhysical : false,
            os: os.trim() ? os.trim() : '',
            gpu: gpu.trim() ? gpu.trim() : ''
        };

        if (editingItem) {
            onSubmit({ id: editingItem.id, ...payload });
        } else {
            onSubmit(payload);
        }
    };

    const availablePositions = Array.from({ length: 42 }, (_, idx) => idx + 1)
        .filter(pos => {
            const isTaken = allNodes.some(n => {
                if (editingItem && n.id === editingItem.id) return false;
                return n.rack === rack && matchesPosition(n.rackPosition, pos);
            });
            return !isTaken;
        })
        .map(pos => {
            const label = `M ${String(pos).padStart(2, '0')}`;
            return { label, value: label };
        });

    if (Array.isArray(rackPosition)) {
        rackPosition.forEach(posVal => {
            if (posVal && !availablePositions.some(opt => opt.value === posVal)) {
                availablePositions.push({ label: posVal, value: posVal });
            }
        });
    }

    const handleSaveNewModel = async () => {
        if (!newModelName.trim()) return;
        try {
            const result = await createServerModel({
                serverModel: newModelName.trim(),
                remarks: newModelRemarks.trim() || undefined
            });
            const res = await fetchServerModels({ pagination: false });
            setServerModels(res.data || []);
            setServerModel(result.serverModel);
            setNewModelName('');
            setNewModelRemarks('');
            setShowNewModelModal(false);
        } catch (err: any) {
            console.error("Failed to create server model", err);
            alert(err?.response?.data?.detail || "Failed to create server model");
        }
    };

    return (
        <>
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Node' : 'Add Node'}
            maxWidth="sm"
        >
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                            <FormLabel sx={{ display: 'block', mb: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                                Device Type
                            </FormLabel>
                            <ToggleButtonGroup
                                color="primary"
                                value={nodeType}
                                exclusive
                                onChange={(e, val) => {
                                    if (val !== null) {
                                        setNodeType(val);
                                        if (val !== 'node') {
                                            setIsPhysical(false);
                                        }
                                    }
                                }}
                                fullWidth
                                size="small"
                            >
                                <ToggleButton value="node" sx={{ textTransform: 'none', fontWeight: 600 }}>Node</ToggleButton>
                                <ToggleButton value="appliance" sx={{ textTransform: 'none', fontWeight: 600 }}>Appliance</ToggleButton>
                                <ToggleButton value="storage" sx={{ textTransform: 'none', fontWeight: 600 }}>Storage</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {nodeType === 'node' && (
                            <Box sx={{ pt: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={isPhysical}
                                            onChange={(e) => setIsPhysical(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label="Is Physical Server"
                                />
                            </Box>
                        )}
                    </Box>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 4}}>
                            <TextField
                                fullWidth
                                label="Node Name"
                                placeholder="e.g. Node-01"
                                value={node}
                                onChange={(e) => setField(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <TextField
                                fullWidth
                                label="IP Address"
                                placeholder="e.g. 192.168.1.10"
                                value={ip}
                                onChange={(e) => setIp(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <TextField
                                fullWidth
                                label="Operating System"
                                placeholder="e.g. RHEL 8 / Ubuntu 22.04"
                                value={os}
                                onChange={(e) => setOs(e.target.value)}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 6}}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Dropdown
                                    label="Server Model"
                                    fullWidth
                                    searchable
                                    clearable
                                    value={serverModel}
                                    onChange={(val) => setServerModel(val)}
                                    options={serverModels.map(sm => ({ label: sm.serverModel, value: sm.serverModel }))}
                                />
                                <IconButton 
                                    color="primary" 
                                    onClick={() => setShowNewModelModal(true)}
                                    sx={{ mt: 1.5, border: '1px solid #1976d2', borderRadius: '8px', padding: '10px' }}
                                    title="Add New Server Model"
                                >
                                    <AddIcon />
                                </IconButton>
                            </Box>
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
                        <Grid size={{xs: 12, sm: admin.includes('Other') ? 2 : 4}}>
                            <Dropdown
                                label="Admin"
                                fullWidth
                                searchable
                                clearable
                                multiple
                                value={admin}
                                onChange={(val) => setAdmin(val)}
                                options={[
                                    ...users.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username, value: u._id || u.id })),
                                    { label: 'Other', value: 'Other' }
                                ]}
                            />
                        </Grid>
                        {admin.includes('Other') && (
                            <Grid size={{xs: 12, sm: 2}}>
                                <TextField
                                    fullWidth
                                    label="Other Admin Name"
                                    placeholder="Enter name"
                                    value={otherAdminName}
                                    onChange={(e) => setOtherAdminName(e.target.value)}
                                    required
                                />
                            </Grid>
                        )}
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
                        <Grid size={{xs: 12, sm: 3}}>
                            <TextField
                                fullWidth
                                label="Total RAM"
                                placeholder="e.g. 128"
                                value={totalRam}
                                onChange={(e) => setTotalRam(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 3}}>
                            <TextField
                                fullWidth
                                label="Total HDD"
                                placeholder="e.g. 1000"
                                value={totalHardisk}
                                onChange={(e) => setTotalHardisk(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 3}}>
                            <TextField
                                fullWidth
                                label="Total CPU"
                                placeholder="e.g. 32"
                                value={totalCpu}
                                onChange={(e) => setTotalCpu(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 3}}>
                            <Dropdown
                                label="GPU"
                                fullWidth
                                searchable
                                clearable
                                value={gpu}
                                onChange={(val) => setGpu(val)}
                                options={gpusList.map(g => ({ label: g.gpuName, value: g.gpuName }))}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <Dropdown
                                label="Server Rack"
                                fullWidth
                                required
                                clearable
                                value={rack}
                                onChange={(val) => setRack(val)}
                                options={racks.map(r => ({ label: r.serverRack, value: r.serverRack }))}
                            />
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}   >
                            <Dropdown
                                label="Rack Position"
                                fullWidth
                                required
                                clearable
                                multiple
                                searchable
                                value={rackPosition}
                                onChange={(val) => setRackPosition(val)}
                                options={availablePositions}
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
        <Dialog 
            open={showNewModelModal} 
            onClose={() => {
                setShowNewModelModal(false);
                setNewModelName('');
                setNewModelRemarks('');
            }}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle sx={{ fontWeight: 'bold', color: '#333' }}>Add New Server Model</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        fullWidth
                        label="Server Model Name"
                        placeholder="e.g. Dell PowerEdge R740"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Remarks"
                        placeholder="Optional remarks..."
                        value={newModelRemarks}
                        onChange={(e) => setNewModelRemarks(e.target.value)}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button 
                    variant="text" 
                    onClick={() => {
                        setShowNewModelModal(false);
                        setNewModelName('');
                        setNewModelRemarks('');
                    }} 
                    style={{ color: '#637381' }}
                >
                    Cancel
                </Button>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={handleSaveNewModel}
                    disabled={!newModelName.trim()}
                >
                    Save Model
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
};

export default NodeModal;
