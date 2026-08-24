import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { validators } from '../../../helpers/validation';
import { type ClusterData, type CreateClusterPayload, type UpdateClusterPayload } from '../model';
import { fetchClusterTypes } from '../../Configurations/ClusterTypes/action';
import request from '../../../services/request';
import styles from "./index.module.scss";

interface ClusterModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateClusterPayload | UpdateClusterPayload) => void;
    editingItem: ClusterData | null;
}

const ClusterModal: React.FC<ClusterModalProps> = ({ open, onClose, onSubmit, editingItem }) => {
    const [formData, setFormData] = useState<CreateClusterPayload>({
        clusterName: '',
        ipAddress: '',
        clusterType: '',
        nodes: [],
        networkType: 'intranet',
        remarks: ''
    });

    const [clusterTypes, setClusterTypes] = useState<any[]>([]);
    const [nodes, setNodes] = useState<any[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setErrors({});
            fetchClusterTypes({ pagination: false })
                .then(res => setClusterTypes(res.data || []))
                .catch(err => console.error("Failed to load cluster types", err));
            request.get('/api/nodes?pagination=false')
                .then(res => {
                    const allNodes = res.data?.data || [];
                    const filteredNodes = allNodes.filter((n: any) => 
                        !n.clusterId || (editingItem && n.clusterId === editingItem.id)
                    );
                    setNodes(filteredNodes);
                })
                .catch(err => console.error("Failed to fetch nodes", err));
        }
    }, [open, editingItem]);

    useEffect(() => {
        if (open) {
            if (editingItem) {
                setFormData({
                    clusterName: editingItem.clusterName || '',
                    ipAddress: editingItem.ipAddress || '',
                    clusterType: editingItem.clusterType || '',
                    nodes: editingItem.nodes || [],
                    networkType: editingItem.networkType || 'intranet',
                    remarks: editingItem.remarks || ''
                });
            } else {
                setFormData({
                    clusterName: '',
                    ipAddress: '',
                    clusterType: '',
                    nodes: [],
                    networkType: 'intranet',
                    remarks: ''
                });
            }
        }
    }, [open, editingItem]);

    const handleChange = (field: keyof CreateClusterPayload, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const nameErr = validators.alphanumericSpaces(formData.clusterName, 50, "Cluster Name");
        const ipErr = validators.ipv4(formData.ipAddress, "IP Address");
        const remarksErr = validators.alphanumericGeneral(formData.remarks, 125, "Remarks");

        const newErrors = {
            clusterName: nameErr,
            ipAddress: ipErr,
            remarks: remarksErr
        };

        setErrors(newErrors);

        if (nameErr || ipErr || remarksErr) {
            return;
        }

        const payloadData = {
            clusterName: formData.clusterName.trim(),
            ipAddress: formData.ipAddress.trim() ? formData.ipAddress.trim() : undefined,
            clusterType: formData.clusterType,
            networkType: formData.networkType,
            remarks: formData.remarks.trim(),
            nodes: formData.nodes
        };

        if (editingItem) {
            const changedData: UpdateClusterPayload = {};
            if (payloadData.clusterName !== editingItem.clusterName) changedData.clusterName = payloadData.clusterName;
            if (payloadData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = payloadData.ipAddress;
            if (payloadData.clusterType !== editingItem.clusterType) changedData.clusterType = payloadData.clusterType;
            if (payloadData.networkType !== editingItem.networkType) changedData.networkType = payloadData.networkType;
            if (payloadData.remarks !== editingItem.remarks) changedData.remarks = payloadData.remarks;
            if (JSON.stringify(payloadData.nodes || []) !== JSON.stringify(editingItem.nodes || [])) {
                changedData.nodes = payloadData.nodes;
            }
            onSubmit(changedData);
        } else {
            onSubmit(payloadData);
        }
    };

    const getNodeLabel = (n: any) => {
        const name = n.node || n.hostName || n.nodeId || 'Node';
        const ip = n.ipAddress || n.ip || n.managementIp || '';
        return ip ? `${name} - ${ip}` : name;
    };

    return (
        <Modal
            open={open}
            handleClose={onClose}
            title={editingItem ? 'Edit Cluster' : 'Add Cluster'}
        >
            <form onSubmit={handleSubmit}>
                <Box className={styles.container}>
                    <Box sx={{ mt: 1, mb: 1 }}>
                        <Dropdown
                            label="Cluster Type"
                            fullWidth
                            value={formData.clusterType}
                            onChange={(val) => handleChange('clusterType', val)}
                            options={clusterTypes.map(ct => ({ label: ct.clusterType, value: ct.clusterType }))}
                        />
                    </Box>
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="Cluster Name"
                            value={formData.clusterName}
                            onChange={(e) => handleChange('clusterName', e.target.value)}
                            required
                            error={!!errors.clusterName}
                            helperText={errors.clusterName}
                        />
                    </Box>
                    <Box sx={{ mt: 1, mb: 1 }}>
                        <Dropdown
                            label="Network Type"
                            fullWidth
                            value={formData.networkType || 'intranet'}
                            onChange={(val) => handleChange('networkType', val)}
                            options={[
                                { label: 'Intranet', value: 'intranet' },
                                { label: 'Internet', value: 'internet' },
                                { label: 'Device Management', value: 'device management' }
                            ]}
                        />
                    </Box>
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="IP Address"
                            value={formData.ipAddress}
                            onChange={(e) => handleChange('ipAddress', e.target.value)}
                            error={!!errors.ipAddress}
                            helperText={errors.ipAddress}
                        />
                    </Box>
                    <Box sx={{ mt: 1 }}>
                        <Dropdown
                            label="Nodes"
                            fullWidth
                            multiple
                            searchable
                            value={formData.nodes || []}
                            onChange={(val) => handleChange('nodes', val)}
                            options={nodes.map(n => ({ label: getNodeLabel(n), value: n.id || n._id }))}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="Remarks"
                            value={formData.remarks}
                            onChange={(e) => handleChange('remarks', e.target.value)}
                            error={!!errors.remarks}
                            helperText={errors.remarks}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {formData.remarks ? formData.remarks.length : 0} / 125
                            </span>
                        </div>
                    </Box>
                </Box>
                <Box className={styles["container__buttonContainer"]}>
                    <Button variant="outlined" onClick={onClose} sx={{ color: '#637381', borderColor: '#637381' }}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">{editingItem ? 'Update' : 'Submit'}</Button>
                </Box>
            </form>
        </Modal>
    );
};

export default ClusterModal;
