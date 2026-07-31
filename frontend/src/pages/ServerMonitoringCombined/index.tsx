// @ts-nocheck
import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

import ServerMonitoring from '../ServerMonitoring';
import ServerPingMonitoring from '../ServerPingMonitoring';

const ServerMonitoringCombined: React.FC = () => {
  const { isSuperuser } = useSelector((state: RootState) => state.auth);

  const canViewServerMonitoring = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_MONITORING_VIEW) || hasPrivilege(PRIVILEGES.VIEW_OWN_VCENTER_VM_MONITORING);
  const canViewPingMonitoring = isSuperuser || hasPrivilege(PRIVILEGES.SERVER_PING_MONITORING_VIEW);

  const availableTabs = [
    ...(canViewServerMonitoring ? [{ id: 'vcenter', label: 'vCenter Monitoring' }] : []),
    ...(canViewPingMonitoring ? [{ id: 'ping', label: 'Server Ping Monitoring' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<string>(() => {
    return availableTabs.length > 0 ? availableTabs[0].id : '';
  });

  if (availableTabs.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">Access Denied</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>You do not have privileges to view Server Monitoring.</Typography>
      </Box>
    );
  }

  const currentTab = availableTabs.some(t => t.id === activeTab) ? activeTab : availableTabs[0].id;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2, bgcolor: '#fff' }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
        >
          {canViewServerMonitoring && <Tab label="vCenter Monitoring" value="vcenter" sx={{ fontWeight: 600 }} />}
          {canViewPingMonitoring && <Tab label="Server Ping Monitoring" value="ping" sx={{ fontWeight: 600 }} />}
        </Tabs>
      </Box>

      <Box sx={{ p: 0 }}>
        {currentTab === 'vcenter' && <ServerMonitoring />}
        {currentTab === 'ping' && <ServerPingMonitoring />}
      </Box>
    </Box>
  );
};

export default ServerMonitoringCombined;
