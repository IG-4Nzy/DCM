import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchUsers } from '../Users/action';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { MdAdd as AddIcon, MdDelete as DeleteIcon, MdEdit as EditIcon, MdSearch as SearchIcon, MdRefresh as RefreshIcon } from 'react-icons/md';
import request from '../../services/request';
import dayjs from 'dayjs';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface LogItem {
  id?: string;
  _id?: string;
  date: string;
  remarks: string;
  status: string;
  loggedBy: string;
  createdAt: string;
}

const OperationLogs: React.FC = () => {
  const canView = hasPrivilege(PRIVILEGES.LOGS_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.LOGS_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.LOGS_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.LOGS_DELETE);

  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state?.users || { users: [] });
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);
  const [logDate, setLogDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [remarks, setRemarks] = useState('');
  const [statusOpen, setStatusOpen] = useState(true); // true = open, false = closed
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/operation-logs', {
        params: {
          skip: 0,
          limit: 100,
          search: search || undefined
        }
      });
      setLogs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch logs', err);
      showToast('Failed to fetch logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      dispatch(fetchUsers({ pagination: false, showToast: undefined }));
      fetchLogs();
    }
  }, [canView, search, dispatch]);

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', py: 10, color: '#64748b' }}>
        <Typography variant="h5" sx={{ color: '#334155', mb: 1, fontWeight: 'bold' }}>
          Access Restricted
        </Typography>
        <Typography variant="body2">
          You need the View Logs privilege to access this feature.
        </Typography>
      </Box>
    );
  }

  const handleOpenCreateModal = () => {
    setEditingLog(null);
    setLogDate(dayjs().format('YYYY-MM-DD'));
    setRemarks('');
    setStatusOpen(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (log: LogItem) => {
    setEditingLog(log);
    setLogDate(log.date);
    setRemarks(log.remarks);
    setStatusOpen(log.status === 'open');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      showToast('Remarks are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: logDate,
        remarks: remarks.trim(),
        status: statusOpen ? 'open' : 'closed'
      };

      const logId = editingLog?.id || editingLog?._id;
      if (editingLog && logId) {
        await request.put(`/api/operation-logs/${logId}`, payload);
        showToast('Operation log updated successfully', 'success');
      } else {
        await request.post('/api/operation-logs', payload);
        showToast('Operation log created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchLogs();
    } catch (err) {
      console.error('Failed to save log', err);
      showToast('Failed to save log', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (log: LogItem) => {
    const logId = log.id || log._id;
    if (!logId) return;

    const isConfirmed = await confirm(`Are you sure you want to delete this log entry?`);
    if (isConfirmed) {
      try {
        await request.delete(`/api/operation-logs/${logId}`);
        showToast('Operation log deleted successfully', 'success');
        fetchLogs();
      } catch (err) {
        console.error('Failed to delete log', err);
        showToast('Failed to delete log', 'error');
      }
    }
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c' }}>
            Operation Logs
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Create, update, and manage shift operation logs, remarks, and status tasks.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchLogs} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: '600',
                boxShadow: '0 4px 6px -1px rgba(49, 130, 206, 0.2)'
              }}
            >
              Create Log
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Grid Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Filters */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />
            }}
            sx={{
              width: '350px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#f8fafc'
              }
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: '600', color: '#4a5568' }}>
            Total logs: <span style={{ color: '#3182ce' }}>{total}</span>
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
              No operation logs found.
            </Typography>
            {canCreate && (
              <Button variant="outlined" size="small" onClick={handleOpenCreateModal} sx={{ borderRadius: '6px' }}>
                Create your first log entry
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Log Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Logged By</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Logged Date & Time</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#4a5568', pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const logCreator = users.find(
                    (u: any) => u.username === log.loggedBy || u._id === log.loggedBy || u.id === log.loggedBy
                  );
                  const creatorFullName = logCreator
                    ? `${logCreator.firstName || ''} ${logCreator.lastName || ''}`.trim() || logCreator.username
                    : log.loggedBy || 'System';

                  return (
                    <TableRow key={log.id || log._id} hover>
                      <TableCell sx={{ fontWeight: '600', color: '#2d3748' }}>
                        {dayjs(log.date).format('DD-MM-YYYY')}
                      </TableCell>
                      <TableCell sx={{ color: '#4a5568', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.remarks}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status === 'open' ? 'Open' : 'Closed'}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            bgcolor: log.status === 'open' ? '#e6fffa' : '#fed7d7',
                            color: log.status === 'open' ? '#0f766e' : '#9b2c2c',
                            border: `1px solid ${log.status === 'open' ? '#b2f5ea' : '#feb2b2'}`
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#4a5568' }}>
                        {creatorFullName}
                      </TableCell>
                      <TableCell sx={{ color: '#718096' }}>
                        {log.createdAt ? dayjs(log.createdAt).format('DD-MM-YYYY HH:mm') : '--'}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          {canUpdate && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenEditModal(log)} sx={{ color: '#4a5568' }}>
                                <EditIcon size={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeleteLog(log)} sx={{ color: '#e53e3e' }}>
                                <DeleteIcon size={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Form Modal Dialog */}
      <Dialog
        open={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', pb: 1, color: '#333' }}>
          {editingLog ? 'Edit Operation Log' : 'Create Operation Log'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              label="Log Date"
              type="date"
              variant="outlined"
              fullWidth
              required
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <TextField
              label="Remarks"
              variant="outlined"
              fullWidth
              required
              multiline
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Write the operation log remarks here..."
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={statusOpen}
                  onChange={(e) => setStatusOpen(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Status: {statusOpen ? 'Open' : 'Closed'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Toggle to switch between open and closed status
                  </Typography>
                </Box>
              }
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            <Button onClick={() => setIsModalOpen(false)} disabled={submitting} sx={{ borderRadius: '8px', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                px: 3,
                boxShadow: '0 4px 6px -1px rgba(49, 130, 206, 0.2)'
              }}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default OperationLogs;
