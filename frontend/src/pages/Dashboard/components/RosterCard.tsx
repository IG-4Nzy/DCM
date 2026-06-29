// @ts-nocheck
import React from 'react';
import { Card, CardContent, Chip, Box, Typography } from '@mui/material';
import { colors, cardSx } from '../constants';
import { SectionHeader } from './SectionHeader';
import type { DashboardData, ShiftInfo } from '../models';

interface RosterCardProps {
  data: DashboardData;
}

export const RosterCard: React.FC<RosterCardProps> = ({ data }) => {
  const activeRows = data.shiftConfig?.rosterRows && data.shiftConfig.rosterRows.length > 0
    ? data.shiftConfig.rosterRows
    : [
        { name: 'Shift 1 Row 1', mappedShift: 'Shift-1' },
        { name: 'Shift 1 Row 2', mappedShift: 'Shift-1' },
        { name: 'Shift 2 Row 1', mappedShift: 'Shift-2' },
        { name: 'Shift 2 Row 2', mappedShift: 'Shift-2' },
        { name: 'Shift 3 Row 1', mappedShift: 'Shift-3' },
        { name: 'Shift 3 Row 2', mappedShift: 'Shift-3' }
      ];

  const configuredShifts = data.shiftConfig?.shifts || [
    { name: 'Shift 1', startTime: '07:00', endTime: '15:00' },
    { name: 'Shift 2', startTime: '09:00', endTime: '17:00' },
    { name: 'Shift 3', startTime: '15:00', endTime: '23:00' }
  ];

  const shiftsToRender = configuredShifts.filter(
    (s: ShiftInfo) => s.name && s.name !== 'Leave' && s.name !== 'None'
  );

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hr = parseInt(parts[0]);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 || 12;
    return `${displayHr.toString().padStart(2, '0')}:${parts[1]} ${ampm}`;
  };

  return (
    <Card sx={cardSx}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <SectionHeader
          title="Today's Roster"
          action={
            <Chip
              label={data.roasterStatus || 'N/A'}
              size="small"
              sx={{
                bgcolor: data.roasterStatus === 'Approved' ? colors.greenLight : data.roasterStatus === 'Submitted' ? colors.amberLight : colors.redLight,
                color: data.roasterStatus === 'Approved' ? colors.green : data.roasterStatus === 'Submitted' ? colors.amber : colors.red,
                fontWeight: 700, border: 'none', height: 24, fontSize: '0.7rem',
              }}
            />
          }
        />
        <Box   gap={1.5} sx={{ flexDirection: 'column', display: 'flex',  py: 1 }}>
          {shiftsToRender.map((sInfo: ShiftInfo) => {
            const sName = sInfo.name;
            const startTime = sInfo.startTime ? formatTime(sInfo.startTime) : '09:00 AM';
            const endTime = sInfo.endTime ? formatTime(sInfo.endTime) : '05:00 PM';

            const staffNames: string[] = [];
            const rosterColumns = ['Shift-1', 'Shift-2', 'Shift-3'];

            rosterColumns.forEach((colShift) => {
              const colRows = [
                activeRows.find((r: any) => r.name === `${colShift.replace('-', ' ')} Row 1`) || { name: `${colShift.replace('-', ' ')} Row 1`, mappedShift: colShift },
                activeRows.find((r: any) => r.name === `${colShift.replace('-', ' ')} Row 2`) || { name: `${colShift.replace('-', ' ')} Row 2`, mappedShift: colShift }
              ];

              const matchedRoaster = data.roasterShifts.find(
                (r: any) => r.shift === colShift && r.department === data.userDepartment
              );

              colRows.forEach((row: any, rIdx: number) => {
                const rowMappedShift = row.mappedShift;
                const isMatch = rowMappedShift && (
                  rowMappedShift === sName || 
                  rowMappedShift.replace(/\s+/g, '-') === sName.replace(/\s+/g, '-')
                );
                if (isMatch) {
                  const a = matchedRoaster?.assigneeDetails?.[rIdx];
                  if (a?.fullName) {
                    staffNames.push(a.fullName);
                  }
                }
              });
            });

            const staffNameStr = staffNames.length > 0 ? staffNames.join(', ') : 'Unassigned';

            return (
              <Box 
                key={sName} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5,
                  py: 0.5,
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '14px', color: colors.textPrimary, minWidth: '150px' }}>
                  {startTime} — {endTime}
                </Typography>
                <Typography sx={{ fontSize: '14px', color: colors.textMuted }}>
                  -
                </Typography>
                <Typography sx={{ fontWeight: staffNames.length > 0 ? 500 : 400, fontSize: '14px', color: staffNames.length > 0 ? colors.textPrimary : '#94A3B8' }}>
                  {staffNameStr}
                </Typography>
              </Box>
            );
          })}

          {/* Show Leave row if someone is marked on leave */}
          {(() => {
            const leaveRoaster = data.roasterShifts.find(
              (r: any) => r.shift === 'Leave' && r.department === data.userDepartment
            );
            const leaveAssignees = leaveRoaster?.assigneeDetails || [];
            const leaveNames = leaveAssignees
              .map((a: any) => a.fullName)
              .filter((name: string): name is string => !!name);

            if (leaveNames.length === 0) return null;

            return (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5,
                  py: 0.5,
                  mt: 0.5,
                  borderTop: `1px dashed ${colors.border || '#E2E8F0'}`,
                  pt: 1,
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '14px', color: colors.red || '#EF4444', minWidth: '150px' }}>
                  On Leave
                </Typography>
                <Typography sx={{ fontSize: '14px', color: colors.textMuted }}>
                  -
                </Typography>
                <Typography sx={{ fontWeight: 500, fontSize: '14px', color: colors.red || '#EF4444' }}>
                  {leaveNames.join(', ')}
                </Typography>
              </Box>
            );
          })()}
        </Box>
      </CardContent>
    </Card>
  );
};
