import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  Tooltip, 
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { 
  MdAdd as AddIcon, 
  MdDelete as DeleteIcon, 
  MdEdit as EditIcon, 
  MdSearch as SearchIcon, 
  MdRefresh as RefreshIcon,
  MdEventNote as ActivityIcon,
  MdAutorenew as RenewIcon,
  MdBuild as ServiceIcon,
  MdCloudUpload as UploadIcon,
  MdAttachFile as FileIcon,
  MdClose as CloseIcon
} from 'react-icons/md';
import request from '../../services/request';
import dayjs from 'dayjs';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

interface ServiceRecord {
  id: string;
  date: string;
  time: string;
  remarks?: string;
  reportName?: string;
  reportUrl?: string;
  createdAt?: string;
}

interface PeriodicActivity {
  id?: string;
  _id?: string;
  name: string;
  dueDate: string;
  remarks?: string;
  department?: string;
  createdAt?: string;
  isAmc?: boolean;
  services?: ServiceRecord[];
}

const PeriodicActivities: React.FC = () => {
  const canView = hasPrivilege(PRIVILEGES.PERIODIC_ACTIVITY_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.PERIODIC_ACTIVITY_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.PERIODIC_ACTIVITY_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.PERIODIC_ACTIVITY_DELETE);

  const [activities, setActivities] = useState<PeriodicActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<PeriodicActivity | null>(null);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isAmc, setIsAmc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Services State
  const [selectedAmcActivity, setSelectedAmcActivity] = useState<PeriodicActivity | null>(null);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [serviceTime, setServiceTime] = useState(dayjs().format('HH:mm'));
  const [serviceRemarks, setServiceRemarks] = useState('');
  const [serviceFile, setServiceFile] = useState<File | null>(null);
  
  // Renew Modal State
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingActivity, setRenewingActivity] = useState<PeriodicActivity | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  const getDaysRemaining = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    return dayjs(dueDateStr).diff(dayjs().startOf('day'), 'day');
  };

  const handleOpenRenewModal = (activity: PeriodicActivity) => {
    setRenewingActivity(activity);
    setNewDueDate(dayjs(activity.dueDate).add(1, 'month').format('YYYY-MM-DD'));
    setIsRenewModalOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) {
      showToast('New Due Date is required', 'warning');
      return;
    }
    if (!renewingActivity) return;

    setSubmitting(true);
    try {
      const activityId = renewingActivity.id || renewingActivity._id;
      const payload = {
        name: renewingActivity.name,
        dueDate: newDueDate,
        remarks: renewingActivity.remarks 
          ? `${renewingActivity.remarks} (Renewed on ${dayjs().format('DD-MM-YYYY')})` 
          : `Renewed on ${dayjs().format('DD-MM-YYYY')}`
      };
      await request.put(`/api/periodic-activities/${activityId}`, payload);
      showToast('Periodic activity renewed successfully', 'success');
      setIsRenewModalOpen(false);
      fetchActivities();
    } catch (err) {
      console.error('Error renewing periodic activity', err);
      showToast('Failed to renew periodic activity', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/periodic-activities', {
        params: {
          skip: 0,
          limit: 100,
          search: search || undefined
        }
      });
      setActivities(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch periodic activities', err);
      showToast('Failed to fetch periodic activities', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchActivities();
    }
  }, [search, canView]);

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', py: 10, color: '#64748b' }}>
        <Typography variant="h5" sx={{ color: '#334155', mb: 1, fontWeight: 'bold' }}>
          Access Restricted
        </Typography>
        <Typography variant="body2">
          You need the View Periodic Activity privilege to access this feature.
        </Typography>
      </Box>
    );
  }

  const handleRefresh = () => {
    fetchActivities();
  };

  const handleOpenCreateModal = () => {
    setEditingActivity(null);
    setName('');
    setDueDate(dayjs().format('YYYY-MM-DD'));
    setRemarks('');
    setIsAmc(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (activity: PeriodicActivity) => {
    setEditingActivity(activity);
    setName(activity.name);
    setDueDate(activity.dueDate);
    setRemarks(activity.remarks || '');
    setIsAmc(activity.isAmc || false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Activity Name is required', 'warning');
      return;
    }
    if (!dueDate) {
      showToast('Due/Expiry Date is required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        dueDate,
        remarks,
        isAmc
      };

      if (editingActivity) {
        const activityId = editingActivity.id || editingActivity._id;
        await request.put(`/api/periodic-activities/${activityId}`, payload);
        showToast('Periodic activity updated successfully', 'success');
      } else {
        await request.post('/api/periodic-activities', payload);
        showToast('Periodic activity created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchActivities();
    } catch (err) {
      console.error('Error saving periodic activity', err);
      showToast('Failed to save periodic activity', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (activity: PeriodicActivity) => {
    const activityId = activity.id || activity._id;
    if (!activityId) return;

    const isConfirmed = await confirm(`Are you sure you want to delete "${activity.name}"?`);
    if (isConfirmed) {
      try {
        await request.delete(`/api/periodic-activities/${activityId}`);
        showToast('Periodic activity deleted successfully', 'success');
        fetchActivities();
      } catch (err) {
        console.error('Failed to delete periodic activity', err);
        showToast('Failed to delete periodic activity', 'error');
      }
    }
  };

  const handleRowClick = (activity: PeriodicActivity, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('svg') || target.closest('.MuiChip-root')) {
      return;
    }
    if (activity.isAmc) {
      setSelectedAmcActivity(activity);
      setIsServicesDialogOpen(true);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmcActivity) return;

    const activityId = selectedAmcActivity.id || selectedAmcActivity._id;
    if (!activityId) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', serviceDate);
      formData.append('time', serviceTime);
      formData.append('remarks', serviceRemarks);
      if (serviceFile) {
        formData.append('file', serviceFile);
      }

      const res = await request.post(`/api/periodic-activities/${activityId}/services`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showToast('Service record added successfully', 'success');
      setSelectedAmcActivity(res.data);
      setServiceDate(dayjs().format('YYYY-MM-DD'));
      setServiceTime(dayjs().format('HH:mm'));
      setServiceRemarks('');
      setServiceFile(null);
      setIsAddServiceOpen(false);
      fetchActivities();
    } catch (err) {
      console.error('Failed to add service', err);
      showToast('Failed to add service record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadReport = async (serviceId: string, file: File) => {
    if (!selectedAmcActivity) return;
    const activityId = selectedAmcActivity.id || selectedAmcActivity._id;
    if (!activityId) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await request.post(`/api/periodic-activities/${activityId}/services/${serviceId}/report`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showToast('Report uploaded successfully', 'success');
      setSelectedAmcActivity(res.data);
      fetchActivities();
    } catch (err) {
      console.error('Failed to upload report', err);
      showToast('Failed to upload report file', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedAmcActivity) return;
    const activityId = selectedAmcActivity.id || selectedAmcActivity._id;
    if (!activityId) return;

    const isConfirmed = await confirm('Are you sure you want to delete this service record?');
    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await request.delete(`/api/periodic-activities/${activityId}/services/${serviceId}`);
      showToast('Service record deleted successfully', 'success');
      setSelectedAmcActivity(res.data);
      fetchActivities();
    } catch (err) {
      console.error('Failed to delete service', err);
      showToast('Failed to delete service record', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c' }}>
            Periodic Activities
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Create and track recurring activities, checkups, certifications, or custom scheduled tasks.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="Refresh Page">
            <IconButton onClick={handleRefresh} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
              Add Activity
            </Button>
          )}
        </Box>
      </Box>

      {/* Filter and Table Container */}
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
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3, 
            gap: 2, 
            flexWrap: 'wrap' 
          }}
        >
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />,
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
            Total Activities: <span style={{ color: '#3182ce' }}>{total}</span>
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : activities.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
              No periodic activities found.
            </Typography>
            {canCreate && (
              <Button variant="outlined" size="small" onClick={handleOpenCreateModal} sx={{ borderRadius: '6px' }}>
                Create your first periodic activity
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Activity Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Due / Expiry Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Department</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#4a5568', pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...activities]
                  .sort((a, b) => getDaysRemaining(a.dueDate) - getDaysRemaining(b.dueDate))
                  .map((activity) => {
                    const formattedDate = activity.dueDate 
                      ? dayjs(activity.dueDate).format('DD-MM-YYYY')
                      : '--';
                    const daysLeft = getDaysRemaining(activity.dueDate);
                    const isCritical = daysLeft <= 7;
                    return (
                      <TableRow 
                        key={activity.id || activity._id} 
                        hover 
                        onClick={(e) => handleRowClick(activity, e)}
                        style={{ cursor: activity.isAmc ? 'pointer' : 'default' }}
                      >
                        <TableCell sx={{ fontWeight: '600', color: '#2d3748' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <ActivityIcon style={{ color: activity.isAmc ? '#10b981' : '#3182ce', fontSize: '22px' }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: '600', color: '#2d3748' }}>
                                {activity.name}
                              </Typography>
                              {activity.isAmc && (
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                                  <Chip label="AMC" size="small" color="success" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }} />
                                  <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                                    {activity.services?.length || 0} services
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell color="textSecondary">
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            {formattedDate}
                            {isCritical && (
                              <Chip
                                label={daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
                                size="small"
                                sx={{
                                  bgcolor: daysLeft < 0 ? '#FEF2F2' : '#FFFBEB',
                                  color: daysLeft < 0 ? '#DC2626' : '#D97706',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  height: 20,
                                  border: `1px solid ${daysLeft < 0 ? '#FCA5A5' : '#FDE68A'}`
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: '#4a5568', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {activity.remarks || '--'}
                        </TableCell>
                        <TableCell sx={{ textTransform: 'capitalize', color: '#718096' }}>
                          {activity.department || 'General'}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            {canUpdate && (
                              <>
                                <Tooltip title="Renew Activity">
                                  <IconButton size="small" onClick={() => handleOpenRenewModal(activity)} sx={{ color: '#059669' }}>
                                    <RenewIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => handleOpenEditModal(activity)} sx={{ color: '#4a5568' }}>
                                    <EditIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {canDelete && (
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => handleDelete(activity)} sx={{ color: '#e53e3e' }}>
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

      {/* Form Dialog Modal */}
      <Dialog 
        open={isModalOpen} 
        onClose={() => !submitting && setIsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', pb: 1, color: '#333' }}>
          {editingActivity ? 'Edit Periodic Activity' : 'Add Periodic Activity'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Activity Name"
              variant="outlined"
              fullWidth
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fire Extinguisher Refill"
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <TextField
              label="Due or Expiry Date"
              type="date"
              variant="outlined"
              fullWidth
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <TextField
              label="Remarks"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter additional remarks or description..."
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={isAmc}
                  onChange={(e) => setIsAmc(e.target.checked)}
                  color="success"
                />
              }
              label="Mark this activity as an AMC"
              sx={{ mt: -0.5, color: '#374151' }}
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

      {/* Renew Activity Dialog Modal */}
      <Dialog 
        open={isRenewModalOpen} 
        onClose={() => !submitting && setIsRenewModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', pb: 1, color: '#333' }}>
          Renew Periodic Activity
        </DialogTitle>
        <form onSubmit={handleRenewSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Typography variant="body2" sx={{ color: '#4a5568', mb: 1 }}>
              Enter the new due/expiry date for <strong>{renewingActivity?.name}</strong>.
            </Typography>
            <TextField
              label="New Due or Expiry Date"
              type="date"
              variant="outlined"
              fullWidth
              required
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            <Button onClick={() => setIsRenewModalOpen(false)} disabled={submitting} sx={{ borderRadius: '8px', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="success"
              disabled={submitting}
              sx={{ 
                borderRadius: '8px', 
                textTransform: 'none',
                px: 3,
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
              }}
            >
              {submitting ? 'Renewing...' : 'Renew'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ═══ AMC Services Dialog ═══ */}
      <Dialog
        open={isServicesDialogOpen}
        onClose={() => setIsServicesDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ServiceIcon style={{ color: '#059669' }} />
            AMC Services — {selectedAmcActivity?.name}
          </Box>
          <IconButton onClick={() => setIsServicesDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: '300px' }}>
          
          {/* Services list */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: '700', color: '#374151' }}>
                Completed Services ({selectedAmcActivity?.services?.length || 0})
              </Typography>
              {canUpdate && !isAddServiceOpen && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<AddIcon />}
                  onClick={() => setIsAddServiceOpen(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: '600' }}
                >
                  Add Service
                </Button>
              )}
            </Box>

            {isAddServiceOpen && (
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: '8px', bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: '#374151' }}>
                  Record New Service
                </Typography>
                <form onSubmit={handleAddService}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        label="Service Date"
                        type="date"
                        size="small"
                        required
                        value={serviceDate}
                        onChange={(e) => setServiceDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, minWidth: '150px' }}
                      />
                      <TextField
                        label="Service Time"
                        type="time"
                        size="small"
                        required
                        value={serviceTime}
                        onChange={(e) => setServiceTime(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, minWidth: '150px' }}
                      />
                    </Box>
                    <TextField
                      label="Service Remarks"
                      size="small"
                      multiline
                      rows={2}
                      value={serviceRemarks}
                      onChange={(e) => setServiceRemarks(e.target.value)}
                      placeholder="Detail of work done, parts replaced, etc."
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={<UploadIcon />}
                        sx={{ textTransform: 'none' }}
                      >
                        {serviceFile ? 'Change Report file' : 'Upload Report (PDF/Doc)'}
                        <input
                          type="file"
                          hidden
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setServiceFile(e.target.files[0]);
                            }
                          }}
                        />
                      </Button>
                      {serviceFile && (
                        <Typography variant="caption" sx={{ color: '#4b5563', fontWeight: 500 }}>
                          Selected: {serviceFile.name}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button size="small" onClick={() => { setIsAddServiceOpen(false); setServiceFile(null); }} sx={{ textTransform: 'none' }}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        color="success"
                        size="small"
                        disabled={submitting}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {submitting ? 'Saving...' : 'Save Service'}
                      </Button>
                    </Box>
                  </Box>
                </form>
              </Paper>
            )}

            {!selectedAmcActivity?.services || selectedAmcActivity.services.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
                <Typography variant="body2" color="textSecondary">
                  No service records logged yet for this AMC.
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f9fafb' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Remarks</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Report Document</TableCell>
                      {canUpdate && <TableCell align="right" sx={{ fontWeight: 'bold' }}>Action</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedAmcActivity.services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {dayjs(`${service.date}T${service.time}`).format('DD-MM-YYYY HH:mm')}
                        </TableCell>
                        <TableCell>{service.remarks || '--'}</TableCell>
                        <TableCell>
                          {service.reportUrl ? (
                            <Button
                              component="a"
                              href={service.reportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              startIcon={<FileIcon />}
                              variant="text"
                              size="small"
                              sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                              {service.reportName || 'View Report'}
                            </Button>
                          ) : (
                            <Button
                              component="label"
                              variant="text"
                              color="primary"
                              size="small"
                              startIcon={<UploadIcon />}
                              sx={{ textTransform: 'none' }}
                            >
                              Upload Report
                              <input
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleUploadReport(service.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </Button>
                          )}
                        </TableCell>
                        {canUpdate && (
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteService(service.id)}
                            >
                              <DeleteIcon size={16} />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsServicesDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PeriodicActivities;
