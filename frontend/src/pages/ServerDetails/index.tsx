// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import SliderTabSelector, { type TabItem } from '../../components/SliderTabSelector';
import Racks from '../Configurations/Racks';
import Clusters from '../Clusters';
import Nodes from '../Configurations/Nodes';
import VMs from '../Clusters/VMDetails';
import PhysicalServers from './PhysicalServers';
import Datastores from './Datastores';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

const ServerDetails = () => {
    const { isSuperuser } = useSelector((state: RootState) => state.auth);

    const hasViewAll = hasPrivilege(PRIVILEGES.VIEW_ALL_SERVER_DETAILS);
    const hasViewOwn = hasPrivilege(PRIVILEGES.VIEW_SERVER_DETAILS);
    const hasCreatePerm = hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

    const hasRacksView = isSuperuser || hasPrivilege(PRIVILEGES.RACKS_VIEW) || hasViewAll || hasCreatePerm;
    const hasClusterView = isSuperuser || hasPrivilege(PRIVILEGES.CLUSTER_VIEW_TAB) || hasViewAll || hasCreatePerm;
    const hasNodesView = isSuperuser || hasPrivilege(PRIVILEGES.NODES_VIEW) || hasViewAll || hasViewOwn || hasCreatePerm;
    const hasVMView = isSuperuser || hasPrivilege(PRIVILEGES.VM_VIEW) || hasViewAll || hasViewOwn || hasCreatePerm;
    const hasPhysicalServerView = isSuperuser || hasPrivilege(PRIVILEGES.PHYSICAL_SERVER_VIEW) || hasViewAll || hasCreatePerm;
    const hasNetworkDevicesView = isSuperuser || hasPrivilege(PRIVILEGES.NETWORK_DEVICE_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_NETWORK_DEVICE) || hasViewAll || hasCreatePerm;
    const hasStorageSystemsView = isSuperuser || hasPrivilege(PRIVILEGES.STORAGE_DEVICE_VIEW) || hasPrivilege(PRIVILEGES.VIEW_ALL_STORAGE_DEVICE) || hasViewAll || hasCreatePerm;
    const hasDatastoresView = isSuperuser || hasViewAll || hasCreatePerm;

    const tabs: TabItem[] = [];
    if (hasRacksView) tabs.push({ id: 'racks', label: 'Racks', value: 'racks' });
    if (hasNodesView) tabs.push({ id: 'nodes', label: 'All Devices', value: 'nodes' });
    if (hasClusterView) tabs.push({ id: 'clusters', label: 'Clusters', value: 'clusters' });
    if (hasVMView) tabs.push({ id: 'vms', label: 'VMs', value: 'vms' });
    if (hasPhysicalServerView) tabs.push({ id: 'physical_servers', label: 'Physical Servers', value: 'physical_servers' });
    if (hasStorageSystemsView) tabs.push({ id: 'storage_systems', label: 'Storage Devices', value: 'storage_systems' });
    if (hasNetworkDevicesView) tabs.push({ id: 'network_devices', label: 'Network Devices', value: 'network_devices' });

    const location = useLocation();
    const isProgrammaticTabChangeRef = useRef(false);

    const [activeTab, setActiveTab] = useState<string | number>(() => {
        const navTab = location.state?.tab;
        if (navTab && tabs.some(tab => String(tab.value) === navTab)) {
            return navTab;
        }
        const saved = localStorage.getItem('server_details_activeTab');
        if (saved && tabs.some(tab => String(tab.value) === saved)) {
            return saved;
        }
        return tabs.length > 0 ? tabs[0].value : "";
    });

    const [dashboardAdminFilter, setDashboardAdminFilter] = useState<string>(() => {
        return location.state?.adminFilter || '';
    });

    useEffect(() => {
        const navTab = location.state?.tab;
        if (navTab && tabs.some(tab => String(tab.value) === navTab)) {
            setActiveTab(navTab);
        }
        if (location.state?.adminFilter) {
            setDashboardAdminFilter(location.state.adminFilter);
        } else {
            setDashboardAdminFilter('');
        }
    }, [location.state]);

    useEffect(() => {
        if (activeTab) {
            localStorage.setItem('server_details_activeTab', String(activeTab));
        }
    }, [activeTab]);

    useEffect(() => {
        if (isProgrammaticTabChangeRef.current) {
            isProgrammaticTabChangeRef.current = false;
            return;
        }

        const filterKeys = [
            'cluster_search',
            'cluster_typeFilter',
            'VMDetails_adminFilter',
            'VMDetails_nodeFilter',
            'VMDetails_powerStatusFilter',
            'VMDetails_networkTypeFilter',
            'VMDetails_clusterTypeFilter',
            'Racks_search',
            'Nodes_search',
            'Nodes_clusterFilter',
            'Nodes_serverModelFilter',
            'Nodes_adminFilter',
            'Nodes_rackFilter',
            'Nodes_osFilter',
            'Nodes_custodianFilter',
            'Nodes_gpuFilter',
            'Nodes_deviceTypeFilter',
            'Nodes_networkTypeFilter',
            'cluster_page',
            'Racks_page',
            'Nodes_page'
        ];
        filterKeys.forEach(key => {
            localStorage.removeItem(key);
        });
    }, [activeTab]);

    useEffect(() => {
        const handleTabChange = (e: CustomEvent) => {
            if (tabs.some(tab => tab.value === e.detail)) {
                isProgrammaticTabChangeRef.current = true;
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
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', boxSizing: 'border-box' }}>
            <label style={{ color: '#333', fontSize: "24px", fontWeight: 'bold', marginBottom: '16px' }}>Server Details</label>
            <Box sx={{ mb: 2 }}>
                <SliderTabSelector
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </Box>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeTab === 'racks' && <Racks key={activeTab} />}
                {activeTab === 'clusters' && <Clusters key={activeTab} />}
                {activeTab === 'nodes' && <Nodes key={activeTab} dashboardAdminFilter={dashboardAdminFilter} />}
                {activeTab === 'vms' && <VMs key={activeTab} dashboardAdminFilter={dashboardAdminFilter} />}
                {activeTab === 'physical_servers' && <Nodes key={activeTab} dashboardAdminFilter={dashboardAdminFilter} nodeTypeFilter="physical" />}
                {activeTab === 'network_devices' && <Nodes key={activeTab} dashboardAdminFilter={dashboardAdminFilter} nodeTypeFilter="appliance" />}
                {activeTab === 'storage_systems' && <Nodes key={activeTab} dashboardAdminFilter={dashboardAdminFilter} nodeTypeFilter="storage" />}
            </Box>
        </Box>
    );
};

export default ServerDetails;
