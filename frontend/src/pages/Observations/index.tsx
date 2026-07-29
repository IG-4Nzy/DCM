// @ts-nocheck
import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import ObservationList from './ObservationList';
import CategoryList from './CategoryList';
import VisitorLogs from '../Requests/VisitorLogs';
import styles from './index.module.scss';

import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

const Observations: React.FC = () => {
  const { isSuperuser, privileges } = useSelector((state: RootState) => state.auth);
  
  const canViewObservations = isSuperuser || hasPrivilege(PRIVILEGES.OBSERVATION_VIEW) || hasPrivilege(PRIVILEGES.OBSERVATION_VIEW_ALL_DEPT);
  const canViewCategories = isSuperuser || hasPrivilege(PRIVILEGES.OBSERVATION_CATEGORY_VIEW, privileges || []);
  const canViewVisitorLogs = isSuperuser || hasPrivilege(PRIVILEGES.VISITOR_LOGS_VIEW);

  const availableTabs = [
    ...(canViewObservations ? [{ id: 0, label: 'Observations' }] : []),
    ...(canViewCategories ? [{ id: 1, label: 'Categories' }] : []),
    ...(canViewVisitorLogs ? [{ id: 2, label: 'Visitor Logs' }] : []),
  ];

  const [activeTab, setActiveTab] = useState<number>(() => {
    return availableTabs.length > 0 ? availableTabs[0].id : 0;
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const currentTab = availableTabs.some(t => t.id === activeTab) ? activeTab : (availableTabs[0]?.id ?? 0);

  return (
    <Box className={styles.observationsContainer} sx={{ p: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="observation tabs">
          {canViewObservations && <Tab label="Observations" value={0} />}
          {canViewCategories && <Tab label="Categories" value={1} />}
          {canViewVisitorLogs && <Tab label="Visitor Logs" value={2} />}
        </Tabs>
      </Box>

      {currentTab === 0 && canViewObservations && <ObservationList />}
      {currentTab === 1 && canViewCategories && <CategoryList />}
      {currentTab === 2 && canViewVisitorLogs && <VisitorLogs />}
    </Box>
  );
};

export default Observations;