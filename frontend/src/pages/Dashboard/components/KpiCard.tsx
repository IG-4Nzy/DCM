import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
} from '@mui/material';

import { colors, cardSx } from '../constants';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon,
  accentColor,
  accentBg,
  onClick,
}) => {
  return (
    <Card
      onClick={onClick}
      sx={{
        ...cardSx,
        flex: 1,
        minWidth: 0,
        borderRadius: 3,
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',

        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: 4,
            }
          : {},
      }}
    >
      <CardContent
        sx={{
          p: 3,
          '&:last-child': {
            pb: 3,
          },
        }}
      >
        {/* Title + Icon Row */}
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          mb={2}
          sx={{flexDirection:"row",display:"flex",placeItems:"center",gap:"8px"}}

        >
          {/* Icon */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: accentBg,
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>

          {/* Title */}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              fontSize: '13px',
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* KPI Value */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: colors.textPrimary,
            lineHeight: 1,
            letterSpacing: '-1px',
            textAlign:"center"
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};