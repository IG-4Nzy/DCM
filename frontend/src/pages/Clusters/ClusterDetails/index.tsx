// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Paper, IconButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack as BackIcon } from 'react-icons/md';
import SliderTabSelector, { type TabItem } from '../../../components/SliderTabSelector';
import ADDetails from '../ADDetails';
import VCenterDetails from '../VCenterDetails';
import VMDetails from '../VMDetails';
import NodeDetails from '../NodeDetails';
import PhysicalServers from '../../ServerDetails/PhysicalServers';
import styles from './index.module.scss';

const tabs: TabItem[] = [
  { id: 'ad-details', label: 'AD Details', value: 'ad_details' },
  { id: 'node-details', label: 'Node Details', value: 'node_details' },
  { id: 'vcenter-details', label: 'Vcenter Details', value: 'vcenter_details' },
  { id: 'vm-details', label: 'VM Details', value: 'vm_details' },
  { id: 'physical-server-details', label: 'Physical Server Details', value: 'physical_server_details' }
];

const ClusterDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | number>(() => {
    return localStorage.getItem('clusterDetailsTab') || 'ad_details';
  });

  useEffect(() => {
    localStorage.setItem('clusterDetailsTab', activeTab.toString());
  }, [activeTab]);

  const handleBack = () => {
    navigate('/cluster');
  };

  return (
    <Box className={styles.container}>
      <Box className={styles.container__header}>
        <IconButton onClick={handleBack} className={styles.container__header__button}>
          <BackIcon />
        </IconButton>
        <label className={styles.container__header__label}>Cluster Details</label>
      </Box>

      <Paper className={styles.container__tabsWrapper}>
        <SliderTabSelector
          tabs={tabs}
          activeTab={activeTab}
          onChange={(val) => setActiveTab(val)}
        />
      </Paper>

      <Paper className={styles.container__contentWrapper}>
        {activeTab === 'ad_details' && (
          <ADDetails clusterId={id || ''} />
        )}
        {activeTab === 'node_details' && (
          <NodeDetails clusterId={id || ''} />
        )}
        {activeTab === 'vcenter_details' && (
          <VCenterDetails clusterId={id || ''} />
        )}
        {activeTab === 'vm_details' && (
          <VMDetails clusterId={id || ''} />
        )}
        {activeTab === 'physical_server_details' && (
          <PhysicalServers clusterId={id || ''} />
        )}
      </Paper>
    </Box>
  );
};

export default ClusterDetails;