import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import ObservationList from './ObservationList';
import CategoryList from './CategoryList';
import styles from './index.module.scss';

const Observations: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box className={styles.observationsContainer} sx={{ p: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="observation tabs">
          <Tab label="Observations" />
          <Tab label="Categories" />
        </Tabs>
      </Box>

      {activeTab === 0 && <ObservationList />}
      {activeTab === 1 && <CategoryList />}
    </Box>
  );
};

export default Observations;