import React from 'react';
import { Card, CardContent, Button, Box, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Tooltip, Chip } from '@mui/material';
import { MdArrowForward } from 'react-icons/md';
import dayjs from 'dayjs';
import { colors, cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';
import type { DashboardData } from '../models';

interface OpenRequestsCardProps {
  data: DashboardData;
  onViewAllClick: () => void;
}

const thSx = {
  fontWeight: 700,
  color: colors.textSecondary,
  py: 1.5,
  fontSize: '12px',
  borderBottom: `1px solid ${colors.border}`,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3px',
};

const tdSx = { py: 1.5, fontSize: '14px', borderBottom: `1px solid ${colors.borderLight}` };

const getRequestStatusColor = (status: string) => {
  const s = status?.toLowerCase() || '';
  if (s.includes('complete') || s.includes('approved')) {
    return { color: colors.green, bg: colors.greenLight };
  }
  if (s.includes('reject') || s.includes('cancel')) {
    return { color: colors.red, bg: colors.redLight };
  }
  if (s.includes('pending') || s.includes('draft') || s.includes('progress')) {
    return { color: colors.amber, bg: colors.amberLight };
  }
  return { color: colors.blue, bg: colors.blueLight };
};

export const OpenRequestsCard: React.FC<OpenRequestsCardProps> = ({ data, onViewAllClick }) => {
  const pendingRequests = (data as any).pendingRequests || [];

  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader
          title="Open Requests"
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
        {pendingRequests.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">No open requests.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Request Type</TableCell>
                  <TableCell sx={thSx}>Created By</TableCell>
                  <TableCell sx={thSx}>Created At</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingRequests.slice(0, 5).map((req: any, idx: number) => {
                  const statusColors = getRequestStatusColor(req.status);
                  return (
                    <TableRow
                      key={req._id}
                      onClick={onViewAllClick}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: idx % 2 === 0 ? 'transparent' : '#FAFBFC',
                        '&:hover': { bgcolor: colors.blueLight },
                        '&:last-child td': { border: 0 },
                      }}
                    >
                      <TableCell sx={{ ...tdSx, color: colors.textPrimary, fontWeight: 600 }}>
                        {req.requestType}
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Tooltip title={req.createdByFullName || req.createdBy || 'Unknown'}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', bgcolor: colors.blue, fontWeight: 700 }}>
                              {req.createdByInitials || '??'}
                            </Avatar>
                          </Tooltip>
                          <Typography sx={{ fontSize: '13px', color: colors.textPrimary }}>
                            {req.createdByFullName || req.createdBy || 'Unknown'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, color: colors.textSecondary }}>
                        {req.createdAt ? dayjs(req.createdAt).format('DD MMM YYYY') : '—'}
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Chip
                          label={req.status}
                          size="small"
                          sx={{
                            bgcolor: statusColors.bg,
                            color: statusColors.color,
                            fontWeight: 700,
                            border: 'none',
                            height: 22,
                            fontSize: '0.7rem',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};
