// @ts-nocheck
import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import SliderTabSelector, { type TabItem } from '../../components/SliderTabSelector';
import Racks from '../Configurations/Racks';
import Clusters from '../Clusters';
import Nodes from '../Configurations/Nodes';
import VMs from '../Clusters/VMDetails';
import PhysicalServers from './PhysicalServers';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

const ServerDetails = () => {
    const { isSuperuser } = useSelector((state: RootState) => state.auth);

    const hasRacksView = isSuperuser || hasPrivilege(PRIVILEGES.RACKS_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const hasClusterView = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_VIEW_TAB) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const hasNodesView = isSuperuser || hasPrivilege(PRIVILEGES.NODES_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const hasVMView = isSuperuser || hasPrivilege(PRIVILEGES.VM_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const hasPhysicalServerView = isSuperuser || hasPrivilege(PRIVILEGES.PHYSICAL_SERVER_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);

    const tabs: TabItem[] = [];
    if (hasRacksView) tabs.push({ id: 'racks', label: 'Racks', value: 'racks' });
    if (hasClusterView) tabs.push({ id: 'clusters', label: 'Clusters', value: 'clusters' });
    if (hasNodesView) tabs.push({ id: 'nodes', label: 'Nodes', value: 'nodes' });
    if (hasVMView) tabs.push({ id: 'vms', label: 'VMs', value: 'vms' });
    if (hasPhysicalServerView) tabs.push({ id: 'physical_servers', label: 'Physical Servers', value: 'physical_servers' });

    const [activeTab, setActiveTab] = useState<string | number>(() => {
        const saved = localStorage.getItem('server_details_activeTab');
        if (saved && tabs.some(tab => String(tab.value) === saved)) {
            return saved;
        }
        return tabs.length > 0 ? tabs[0].value : "";
    });

    const location = useLocation();

    useEffect(() => {
        const navTab = location.state?.tab;
        if (navTab && tabs.some(tab => String(tab.value) === navTab)) {
            setActiveTab(navTab);
        }
    }, [location.state]);

    useEffect(() => {
        if (activeTab) {
            localStorage.setItem('server_details_activeTab', String(activeTab));
        }
    }, [activeTab]);

    useEffect(() => {
        const handleTabChange = (e: CustomEvent) => {
            if (tabs.some(tab => tab.value === e.detail)) {
                setActiveTab(e.detail);
            }
        };
        window.addEventListener('changeServerDetailsTab', handleTabChange as EventListener);
        return () => window.removeEventListener('changeServerDetailsTab', handleTabChange as EventListener);
    }, [tabs]);

    if (tabs.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <label style={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 'bold' }}>Access Denied</label>
                <p style={{ color: '#666', marginTop: '16px' }}>You do not have privileges to view Server Details.</p>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <label style={{ color: '#333', fontSize: "24px", fontWeight: 'bold', marginBottom: '16px' }}>Server Details</label>
            <Box sx={{ mb: 2 }}>
                <SliderTabSelector
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {activeTab === 'racks' && <Racks />}
                {activeTab === 'clusters' && <Clusters />}
                {activeTab === 'nodes' && <Nodes />}
                {activeTab === 'vms' && <VMs />}
                {activeTab === 'physical_servers' && <PhysicalServers />}
            </Box>
        </Box>
    );
};

export default ServerDetails;
