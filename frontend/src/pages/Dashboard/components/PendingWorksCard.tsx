// @ts-nocheck
import React from 'react';
import { Card, CardContent, Button, Box, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Tooltip, Chip } from '@mui/material';
import { MdArrowForward } from 'react-icons/md';
import dayjs from 'dayjs';
import { colors, cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';
import { getPriorityColor } from '../utils';
import type { DashboardData } from '../models';

interface PendingWorksCardProps {
  data: DashboardData;
  onViewAllClick: () => void;
}

const thSx = { fontWeight: 700, color: colors.textSecondary, py: 1.5, fontSize: '12px', borderBottom: `1px solid ${colors.border}`, textTransform: 'uppercase' as const, letterSpacing: '0.3px' };
const tdSx = { py: 1.5, fontSize: '14px', borderBottom: `1px solid ${colors.borderLight}` };

export const PendingWorksCard: React.FC<PendingWorksCardProps> = ({ data, onViewAllClick }) => {
  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader
          title="Pending Works"
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
        {data.pendingWorks.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">No pending works.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Task Name</TableCell>
                  <TableCell sx={thSx}>Assignee</TableCell>
                  <TableCell sx={thSx}>Due Date</TableCell>
                  <TableCell sx={thSx}>Priority</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.pendingWorks.map((work, idx) => (
                  <TableRow
                    key={work._id}
                    onClick={onViewAllClick}
                    sx={{
                      cursor: 'pointer', bgcolor: idx % 2 === 0 ? 'transparent' : '#FAFBFC',
                      '&:hover': { bgcolor: colors.blueLight }, '&:last-child td': { border: 0 },
                    }}
                  >
                    <TableCell sx={{ ...tdSx, color: colors.textPrimary, fontWeight: 600 }}>
                      {work.workName}
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={work.assigneeName || 'Unassigned'}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', bgcolor: colors.purple, fontWeight: 700 }}>
                            {work.assigneeInitials || 'UN'}
                          </Avatar>
                        </Tooltip>
                        <Typography sx={{ fontSize: '13px', color: colors.textPrimary }}>
                          {work.assigneeName || 'Unassigned'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...tdSx, color: colors.textSecondary }}>
                      {work.dueDate ? dayjs(work.dueDate).format('DD MMM YYYY') : '—'}
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Chip
                        label={work.priority}
                        size="small"
                        sx={{
                          bgcolor: `${getPriorityColor(work.priority)}12`,
                          color: getPriorityColor(work.priority),
                          fontWeight: 700, border: 'none', height: 22, fontSize: '0.7rem',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};
