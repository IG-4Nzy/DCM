import React from 'react';
import { Box, Typography } from '@mui/material';
import { colors } from '../constants';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => (
  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
    <Typography sx={{ fontSize: '17px', fontWeight: 700, color: colors.textPrimary }}>
      {title}
    </Typography>
    {action}
  </Box>
);
