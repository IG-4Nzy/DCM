import React from 'react';
import { Card, CardContent, Button, Box, Typography, Chip } from '@mui/material';
import { MdArrowForward } from 'react-icons/md';
import { colors, cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';

interface RecentOperationLogsCardProps {
  openOperationLogs: any[];
  onViewAllClick: () => void;
}

export const RecentOperationLogsCard: React.FC<RecentOperationLogsCardProps> = ({ openOperationLogs, onViewAllClick }) => {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader
          title="Open Operation Logs"
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
        {openOperationLogs.length === 0 ? (
          <Box py={4} textAlign="center">
            <Typography variant="body2" color="textSecondary">No open operational logs.</Typography>
          </Box>
        ) : (
          <Box>
            {openOperationLogs.map((log, idx) => (
              <Box
                key={log._id || log.id}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: 1.5, borderBottom: idx < openOperationLogs.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                }}
              >
                <Box sx={{ pr: 2, flex: 1 }}>
                  <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'pre-wrap' }}>
                    {log.remarks}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: colors.textMuted, mt: 0.5 }}>
                    Date: {log.date} · Logged by: @{log.loggedBy}
                  </Typography>
                </Box>
                <Chip
                  label="Open"
                  size="small"
                  sx={{
                    bgcolor: colors.amberLight,
                    color: colors.amber,
                    fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                    flexShrink: 0
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
