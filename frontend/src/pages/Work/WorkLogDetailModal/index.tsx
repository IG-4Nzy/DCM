// @ts-nocheck
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
  Paper,
  Divider,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import { MdClose as CloseIcon, MdAccessTime as TimeIcon, MdPerson as PersonIcon, MdCalendarToday as CalendarIcon } from 'react-icons/md';
import Button from '../../../components/Button';
import type { WorkLogData } from '../model';
import { parseTimeToMinutes } from '../WorkLogFormModal';

interface WorkLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: WorkLogData | null;
}

const formatMinutesToHours = (totalMins: number): string => {
  if (totalMins <= 0) return '0 hrs';
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} mins`;
  if (hrs > 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${mins} mins`;
};

const WorkLogDetailModal: React.FC<WorkLogDetailModalProps> = ({ isOpen, onClose, log }) => {
  if (!log) return null;

  let totalDurationMins = 0;
  if (log.entries && log.entries.length > 0) {
    log.entries.forEach(e => {
      const s = parseTimeToMinutes(e.startTime);
      const end = parseTimeToMinutes(e.endTime);
      if (end > s && s >= 0) {
        totalDurationMins += (end - s);
      }
    });
  }

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          Work Log Details
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon color="#1976d2" size={20} />
              <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                Date:
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {log.date}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="#1976d2" size={20} />
              <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                User:
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {log.userFullName || log.username} ({log.username})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimeIcon color="#1976d2" size={20} />
              <Typography variant="subtitle2" sx={{ color: '#64748b' }}>
                Total Tracked Time:
              </Typography>
              <Chip
                label={formatMinutesToHours(totalDurationMins)}
                color="primary"
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </Box>
        </Paper>

        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5, color: '#334155' }}>
          Time Period Updates & Activities
        </Typography>

        <Table size="small" sx={{ border: '1px solid #e2e8f0' }}>
          <TableHead sx={{ bgcolor: '#f1f5f9' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: 60 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 140 }}>Start Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 140 }}>End Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Duration</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Activity Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {log.entries && log.entries.length > 0 ? (
              log.entries.map((entry, idx) => {
                const s = parseTimeToMinutes(entry.startTime);
                const end = parseTimeToMinutes(entry.endTime);
                const dur = (end > s && s >= 0) ? (end - s) : 0;
                return (
                  <TableRow key={entry.id || idx} hover>
                    <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>{entry.startTime}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>{entry.endTime}</TableCell>
                    <TableCell>
                      <Chip label={formatMinutesToHours(dur)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{entry.activity}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#64748b' }}>
                  No time slots recorded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" color="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkLogDetailModal;
