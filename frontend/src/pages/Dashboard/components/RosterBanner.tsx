import React from 'react';
import { Alert, Box, Typography, Button } from '@mui/material';
import { Icons } from '../../../helpers/icons';
import { colors } from '../constants';

interface RosterBannerProps {
  show: boolean;
  onConfigureClick: () => void;
}

export const RosterBanner: React.FC<RosterBannerProps> = ({ show, onConfigureClick }) => {
  if (!show) return null;

  return (
    <Alert
      severity="warning"
      icon={<Icons.RoasterIcon style={{ fontSize: '1.5rem', color: colors.amber }} />}
      sx={{
        mb: 3, borderRadius: '14px', border: `1px solid ${colors.amber}30`, background: colors.amberLight,
        boxShadow: 'none', alignItems: 'center',
        '& .MuiAlert-message': { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
      }}
    >
      <Box>
        <Typography variant="subtitle2" fontWeight={700} color={colors.amber}>Weekly Roster Reminder</Typography>
        <Typography variant="body2" color="textSecondary">
          Please ensure the upcoming week's roster is configured, reviewed, and submitted for approval.
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={onConfigureClick}
        sx={{
          fontWeight: 700, textTransform: 'none', borderRadius: '10px',
          bgcolor: colors.amber, color: '#fff', boxShadow: 'none',
          '&:hover': { bgcolor: '#D97706', boxShadow: 'none' },
        }}
      >
        Configure Roster
      </Button>
    </Alert>
  );
};
