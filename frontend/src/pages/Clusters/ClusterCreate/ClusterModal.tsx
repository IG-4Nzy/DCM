// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
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
        remarks: ''
    });

    const [clusterTypes, setClusterTypes] = useState<any[]>([]);
    const [nodes, setNodes] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
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
                    remarks: editingItem.remarks || ''
                });
            } else {
                setFormData({
                    clusterName: '',
                    ipAddress: '',
                    clusterType: '',
                    nodes: [],
                    remarks: ''
                });
            }
        }
    }, [open, editingItem]);

    const handleChange = (field: keyof CreateClusterPayload, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingItem) {
            const changedData: UpdateClusterPayload = {};
            if (formData.clusterName !== editingItem.clusterName) changedData.clusterName = formData.clusterName;
            if (formData.ipAddress !== editingItem.ipAddress) changedData.ipAddress = formData.ipAddress;
            if (formData.clusterType !== editingItem.clusterType) changedData.clusterType = formData.clusterType;
            if (formData.remarks !== editingItem.remarks) changedData.remarks = formData.remarks;
            if (JSON.stringify(formData.nodes || []) !== JSON.stringify(editingItem.nodes || [])) {
                changedData.nodes = formData.nodes;
            }
            onSubmit(changedData);
        } else {
            onSubmit(formData);
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
                        />
                    </Box>
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="IP Address"
                            value={formData.ipAddress}
                            onChange={(e) => handleChange('ipAddress', e.target.value)}
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
                    <Box>
                        <TextField
                            fullWidth
                            className={styles.container__field}
                            label="Remarks"
                            value={formData.remarks}
                            onChange={(e) => handleChange('remarks', e.target.value)}
                        />
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
