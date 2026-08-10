// @ts-nocheck
import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { MdFactCheck, MdWbSunny } from 'react-icons/md';
import { hasPrivilege, hasAnyPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

// Lazy-ish — we import directly since they are within the same app bundle
import BMSChecklist from '../BMSChecklist';
import ClusterChecklist from '../ClusterChecklist';
import MorningChecklist from './MorningChecklist';

const DailyActivities: React.FC = () => {
  const isSuperuser = useSelector((state: RootState) => state.auth.isSuperuser);

  const hasBMS = isSuperuser || hasAnyPrivilege([PRIVILEGES.BMS_CHECKLIST_VIEW, PRIVILEGES.BMS_CHECKLIST_VIEW_ALL_DEPT]);
  const hasCluster = isSuperuser || hasAnyPrivilege([PRIVILEGES.CLUSTER_CHECKLIST_VIEW, PRIVILEGES.CLUSTER_CHECKLIST_VIEW_ALL_DEPT]);
  const hasMorning = isSuperuser || hasPrivilege(PRIVILEGES.MORNING_CHECKLIST_VIEW);

  // Build tab list dynamically based on privileges
  const tabs: { label: string; icon: React.ReactElement; component: React.ReactNode }[] = [];
  if (hasBMS) {
    tabs.push({ label: 'BMS Checklist', icon: <MdFactCheck />, component: <BMSChecklist /> });
  }
  if (hasCluster) {
    tabs.push({ label: 'Cluster Checklist', icon: <MdFactCheck />, component: <ClusterChecklist /> });
  }
  if (hasMorning) {
    tabs.push({ label: 'Morning Checklist', icon: <MdWbSunny />, component: <MorningChecklist /> });
  }

  const [activeTab, setActiveTab] = useState(0);

  if (tabs.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">Access Denied</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          You do not have the required privileges for any daily activity module.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
        Checklist
      </Typography>

      {tabs.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            mb: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 48,
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            }
          }}
        >
          {tabs.map((tab, idx) => (
            <Tab
              key={idx}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      )}

      <Box sx={{ mt: 1 }}>
        {tabs[activeTab]?.component}
      </Box>
    </Box>
  );
};

export default DailyActivities;
