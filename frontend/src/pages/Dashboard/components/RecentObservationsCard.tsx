import React from 'react';
import { Card, CardContent, Button, Box, Typography, Chip } from '@mui/material';
import { MdArrowForward } from 'react-icons/md';
import { colors, cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';

interface RecentObservationsCardProps {
  latestObservations: any[];
  onViewAllClick: () => void;
}

export const RecentObservationsCard: React.FC<RecentObservationsCardProps> = ({ latestObservations, onViewAllClick }) => {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader
          title="Recent Observations"
          action={
            <Button
              size="small"
              endIcon={<MdArrowForward />}
              onClick={onViewAllClick}
              sx={{ textTransform: 'none', fontWeight: 600, color: colors.blue, fontSize: '13px' }}
            >
              View All
            </Button>
          }
        />
        {latestObservations.length === 0 ? (
          <Box py={4} textAlign="center">
            <Typography variant="body2" color="textSecondary">No observations logged today.</Typography>
          </Box>
        ) : (
          <Box>
            {latestObservations.map((obs, idx) => (
              <Box
                key={obs._id}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: 1.5, borderBottom: idx < latestObservations.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                    {obs.observationId}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: colors.textMuted }}>
                    {obs.category} · {obs.observedTime}
                  </Typography>
                </Box>
                <Chip
                  label={obs.status}
                  size="small"
                  sx={{
                    bgcolor: obs.status === 'Resolved' ? colors.greenLight : colors.redLight,
                    color: obs.status === 'Resolved' ? colors.green : colors.red,
                    fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
