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
}

export const ChecklistStatusCard: React.FC<ChecklistStatusCardProps> = ({ data, onMorningClick, onBmsClick }) => {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader title="Checklist Status" />
        <Box sx={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <ChecklistCard
            title="Morning Checklist"
            status={data.checklists.morning}
            icon={<Icons.DailyActivitiesIcon />}
            onClick={onMorningClick}
          />
          <ChecklistCard
            title="BMS Checklist"
            status={data.checklists.bms}
            icon={<Icons.BMSChecklistIcon />}
            onClick={onBmsClick}
          />
        </Box>
      </CardContent>
    </Card>
  );
};
