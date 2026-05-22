import React, { useState } from 'react';
import { Box, Paper, IconButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack as BackIcon } from 'react-icons/md';
import SliderTabSelector, { type TabItem } from '../../../components/SliderTabSelector';
import ADDetails from '../ADDetails';
import VCenterDetails from '../VCenterDetails';

const tabs: TabItem[] = [
    { id: 'ad-details', label: 'AD Details', value: 'ad_details' },
    { id: 'node-details', label: 'Node Details', value: 'node_details' },
    { id: 'vcenter-details', label: 'Vcenter Details', value: 'vcenter_details' },
    { id: 'vm-details', label: 'VM Details', value: 'vm_details' }
];

const ClusterDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<string | number>('ad_details');

    const handleBack = () => {
        navigate('/cluster');
    };

    return (
        <Box sx={{ p: 3, width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                <IconButton onClick={handleBack} sx={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                    <BackIcon />
                </IconButton>
                <label style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Cluster Details</label>
            </Box>

            <Paper sx={{ p: 2, mb: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <SliderTabSelector 
                    tabs={tabs} 
                    activeTab={activeTab} 
                    onChange={(val) => setActiveTab(val)} 
                />
            </Paper>

            <Paper sx={{ flexGrow: 1, p: 3, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#fff' }}>
                {activeTab === 'ad_details' && (
                    <ADDetails clusterId={id || ''} />
                )}
                {activeTab === 'node_details' && (
                    <Box>
                        <h3>Node Details</h3>
                        <p>Content for Node Details goes here...</p>
                    </Box>
                )}
                {activeTab === 'vcenter_details' && (
                    <VCenterDetails clusterId={id || ''} />
                )}
                {activeTab === 'vm_details' && (
                    <Box>
                        <h3>VM Details</h3>
                        <p>Content for VM Details goes here...</p>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default ClusterDetails;