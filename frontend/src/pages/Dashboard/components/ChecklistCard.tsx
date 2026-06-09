import React from 'react';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import { colors } from '../constants';
import { getChecklistPct, getStatusColor } from '../utils';

interface ChecklistCardProps {
  title: string;
  status: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ title, status, icon, onClick }) => {
  const pct = getChecklistPct(status);
  const { color, bg } = getStatusColor(status);

  return (
    <Box
      onClick={onClick}
      sx={{
        border: `1px solid ${colors.border}`,
        borderRadius: '14px',
        p: 2.5,
        bgcolor: colors.cardBg,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': { borderColor: color, boxShadow: `0 2px 12px ${color}20`, transform: 'translateY(-1px)' }
      }}
    >
      <Box sx={{display:"flex",flexDirection:"row",placeItems:"center",gap:"6px",}}>
        <Box sx={{display:"flex",gap:"6px",}}>
          <Box sx={{ color, fontSize: 18, display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontWeight: 600, color: colors.textPrimary, fontSize: '14px' }}>
            {title}
          </Typography>
        </Box>
        <Chip
          label={status || 'Not Started'}
          size="small"
          sx={{
            bgcolor: bg, color, fontWeight: 700, border: `1px solid ${color}30`,
            height: 24, fontSize: '0.7rem', letterSpacing: '0.3px',
          }}
        />
      </Box>
      <Box sx={{display:"flex",gap:"8px",marginTop:"8px",placeItems:"center"}}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8, borderRadius: 4, bgcolor: `${color}15`,
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: color },
            }}
          />
        </Box>
        <Typography sx={{ fontWeight: 700, color, fontSize: '13px', minWidth: 36, textAlign: 'right' }}>
          {pct}%
        </Typography>
      </Box>
    </Box>
  );
};
