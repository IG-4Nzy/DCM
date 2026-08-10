// @ts-nocheck
import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

import IpList from '../IpList';
import PhoneDirectory from '../PhoneDirectory';

const IpAndPhoneDirectory: React.FC = () => {
  const { isSuperuser } = useSelector((state: RootState) => state.auth);

  const canViewIpList = isSuperuser || hasPrivilege(PRIVILEGES.IP_LIST_VIEW);
  const canViewPhoneDirectory = isSuperuser || hasPrivilege(PRIVILEGES.PHONE_DIRECTORY_VIEW);

  const availableTabs = [
    ...(canViewIpList ? [{ id: 'ipList', label: 'IP List' }] : []),
    ...(canViewPhoneDirectory ? [{ id: 'phoneDirectory', label: 'Phone Directory' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<string>(() => {
    return availableTabs.length > 0 ? availableTabs[0].id : '';
  });

  if (availableTabs.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">Access Denied</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>You do not have privileges to view IP List or Phone Directory.</Typography>
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
          {canViewIpList && <Tab label="IP List" value="ipList" sx={{ fontWeight: 600 }} />}
          {canViewPhoneDirectory && <Tab label="Phone Directory" value="phoneDirectory" sx={{ fontWeight: 600 }} />}
        </Tabs>
      </Box>

      <Box sx={{ p: 0 }}>
        {currentTab === 'ipList' && <IpList />}
        {currentTab === 'phoneDirectory' && <PhoneDirectory />}
      </Box>
    </Box>
  );
};

export default IpAndPhoneDirectory;
