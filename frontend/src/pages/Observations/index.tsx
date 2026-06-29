// @ts-nocheck
import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import ObservationList from './ObservationList';
import CategoryList from './CategoryList';
import styles from './index.module.scss';

import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

const Observations: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  
  const { isSuperuser, privileges } = useSelector((state: RootState) => state.auth);
  const canViewCategories = isSuperuser || hasPrivilege(PRIVILEGES.OBSERVATION_CATEGORY_VIEW, privileges || []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box className={styles.observationsContainer} sx={{ p: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="observation tabs">
          <Tab label="Observations" value={0} />
          {canViewCategories && <Tab label="Categories" value={1} />}
        </Tabs>
      </Box>

      {activeTab === 0 && <ObservationList />}
      {activeTab === 1 && canViewCategories && <CategoryList />}
    </Box>
  );
};

export default Observations;