// @ts-nocheck
import React from 'react';
import { Card, CardContent, Box } from '@mui/material';
import { cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';
import { ChecklistCard } from './ChecklistCard';
import { Icons } from '../../../helpers/icons';
import type { DashboardData } from '../models';

interface ChecklistStatusCardProps {
  data: DashboardData;
  onMorningClick: () => void;
  onBmsClick: () => void;
  onClusterClick: () => void;
  canViewMorningChecklist: boolean;
  canViewBmsChecklist: boolean;
  canViewClusterChecklist: boolean;
}

export const ChecklistStatusCard: React.FC<ChecklistStatusCardProps> = ({ 
  data, onMorningClick, onBmsClick, onClusterClick,
  canViewMorningChecklist, canViewBmsChecklist, canViewClusterChecklist
}) => {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader title="Checklist Status" />
        <Box sx={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {canViewMorningChecklist && (
            <ChecklistCard
              title="Morning Checklist"
              status={data.checklists.morning}
              icon={<Icons.DailyActivitiesIcon />}
              onClick={onMorningClick}
            />
          )}
          {canViewBmsChecklist && (
            <ChecklistCard
              title="BMS Checklist"
              status={data.checklists.bms}
              icon={<Icons.BMSChecklistIcon />}
              onClick={onBmsClick}
            />
          )}
          {canViewClusterChecklist && (
            <ChecklistCard
              title="Cluster Checklist"
              status={data.checklists.cluster}
              icon={<Icons.ClusterIcon />}
              onClick={onClusterClick}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
