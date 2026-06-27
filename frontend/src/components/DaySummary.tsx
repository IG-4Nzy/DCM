import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import request from '../services/request';
import dayjs from 'dayjs';

import { fetchDaySummaryData } from '../helpers/daySummary';

interface Props {
  date: string; // YYYY-MM-DD
}

const DaySummary: React.FC<Props> = ({ date }) => {
  const [observations, setObservations] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);

  useEffect(() => {
    if (!date) return;

    const loadData = async () => {
      const data = await fetchDaySummaryData(date);
      setObservations(data.observations);
      setVisitors(data.visitors);
    };
    loadData();
  }, [date]);

  if (observations.length === 0 && visitors.length === 0) return null;

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#334155' }}>
        Activity Summary for {dayjs(date).format('DD MMM YYYY')}
      </Typography>
      
      {observations.length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} variant="outlined">
          <Typography variant="subtitle1" sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>
            Observations
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                  <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Logged By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {observations.map(obs => (
                  <TableRow key={obs._id} hover>
                    <TableCell>{obs.observationId}</TableCell>
                    <TableCell>{obs.description}</TableCell>
                    <TableCell>{obs.category}</TableCell>
                    <TableCell>
                      <Chip 
                        label={obs.status} 
                        size="small" 
                        color={obs.status === 'Resolved' ? 'success' : 'warning'}
                        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>{obs.loggedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {visitors.length > 0 && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} variant="outlined">
          <Typography variant="subtitle1" sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569' }}>
            Visitor Logs
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Visitor Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Division</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Entry Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Exit Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visitors.map(v => (
                  <TableRow key={v._id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{v.visitorName}</TableCell>
                    <TableCell>{v.division}</TableCell>
                    <TableCell>{v.purpose}</TableCell>
                    <TableCell>{dayjs(v.entryTime).format('HH:mm')}</TableCell>
                    <TableCell>{v.exitTime ? dayjs(v.exitTime).format('HH:mm') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default DaySummary;
