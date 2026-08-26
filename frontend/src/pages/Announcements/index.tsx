// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import TextField from '../../components/TextField';
import {
  MdAdd as AddIcon,
  MdDelete as DeleteIcon,
  MdEdit as EditIcon,
  MdSearch as SearchIcon,
  MdRefresh as RefreshIcon,
  MdCampaign as AnnouncementIcon
} from 'react-icons/md';
import request from '../../services/request';
import dayjs from 'dayjs';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

interface Announcement {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  date?: string; // Optional YYYY-MM-DD
  mentionType: string; // "all", "department", "staff"
  mentionedDepartment?: string;
  mentionedStaff?: string;
  createdBy?: string;
  department?: string;
  createdAt?: string;
}

const Announcements: React.FC = () => {
  const canView = hasPrivilege(PRIVILEGES.ANNOUNCEMENT_VIEW);
  const canCreate = hasPrivilege(PRIVILEGES.ANNOUNCEMENT_CREATE);
  const canUpdate = hasPrivilege(PRIVILEGES.ANNOUNCEMENT_UPDATE);
  const canDelete = hasPrivilege(PRIVILEGES.ANNOUNCEMENT_DELETE);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Data lists for selection
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [mentionType, setMentionType] = useState('all');
  const [mentionedDepartment, setMentionedDepartment] = useState('');
  const [mentionedStaff, setMentionedStaff] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/announcements', {
        params: {
          skip: 0,
          limit: 100,
          search: search || undefined
        }
      });
      setAnnouncements(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch announcements', err);
      showToast('Failed to fetch announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      // Load departments
      const deptsRes = await request.get('/api/departments', { params: { pagination: false } });
      setDepartments(deptsRes.data.data || []);

      // Load users
      const usersRes = await request.get('/api/users', { params: { pagination: false } });
      setUsers(usersRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch metadata for dropdowns', err);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchAnnouncements();
      fetchMetadata();
    }
  }, [search, canView]);

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', py: 10, color: '#64748b' }}>
        <Typography variant="h5" sx={{ color: '#334155', mb: 1, fontWeight: 'bold' }}>
          Access Restricted
        </Typography>
        <Typography variant="body2">
          You need the View Announcements privilege to access this feature.
        </Typography>
      </Box>
    );
  }

  const handleRefresh = () => {
    fetchAnnouncements();
  };

  const handleOpenCreateModal = () => {
    setEditingAnnouncement(null);
    setTitle('');
    setDescription('');
    setDate('');
    setMentionType('all');
    setMentionedDepartment('');
    setMentionedStaff('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setTitle(ann.title);
    setDescription(ann.description);
    setDate(ann.date || '');
    setMentionType(ann.mentionType);
    setMentionedDepartment(ann.mentionedDepartment || '');
    setMentionedStaff(ann.mentionedStaff || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Title is required', 'warning');
      return;
    }
    if (!description.trim()) {
      showToast('Description is required', 'warning');
      return;
    }
    if (mentionType === 'department' && !mentionedDepartment) {
      showToast('Please select a target Department', 'warning');
      return;
    }
    if (mentionType === 'staff' && !mentionedStaff) {
      showToast('Please select a target Staff member', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        date: date || null,
        mentionType,
        mentionedDepartment: mentionType === 'department' ? mentionedDepartment : '',
        mentionedStaff: mentionType === 'staff' ? mentionedStaff : ''
      };

      const annId = editingAnnouncement?.id || editingAnnouncement?._id;
      if (editingAnnouncement && annId) {
        await request.put(`/api/announcements/${annId}`, payload);
        showToast('Announcement updated successfully', 'success');
      } else {
        await request.post('/api/announcements', payload);
        showToast('Announcement created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error('Error saving announcement', err);
      showToast('Failed to save announcement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ann: Announcement) => {
    const annId = ann.id || ann._id;
    if (!annId) return;

    const isConfirmed = await confirm(`Are you sure you want to delete announcement "${ann.title}"?`);
    if (isConfirmed) {
      try {
        await request.delete(`/api/announcements/${annId}`);
        showToast('Announcement deleted successfully', 'success');
        fetchAnnouncements();
      } catch (err) {
        console.error('Failed to delete announcement', err);
        showToast('Failed to delete announcement', 'error');
      }
    }
  };

  const getDaysRemaining = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    return dayjs(dueDateStr).diff(dayjs().startOf('day'), 'day');
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c' }}>
            Announcements
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Publish messages, policies, or event dates to specific users, departments, or all staffs.
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
              Create Announcement
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
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} />,
              }
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
            Total Announcements: <span style={{ color: '#3182ce' }}>{total}</span>
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : announcements.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
              No announcements found.
            </Typography>
            {canCreate && (
              <Button variant="outlined" size="small" onClick={handleOpenCreateModal} sx={{ borderRadius: '6px' }}>
                Publish your first announcement
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Mentions</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Target Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Created By</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#4a5568', pr: 3 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {announcements.map((ann) => {
                  const formattedDate = ann.date
                    ? dayjs(ann.date).format('DD-MM-YYYY')
                    : '--';
                  const daysLeft = getDaysRemaining(ann.date);

                  let mentionLabel = 'All Staffs';
                  if (ann.mentionType === 'department') {
                    const deptName = departments.find(d => (d.id || d._id) === ann.mentionedDepartment)?.name || ann.mentionedDepartment;
                    mentionLabel = `Dept: ${deptName}`;
                  } else if (ann.mentionType === 'staff') {
                    mentionLabel = `Staff: @${ann.mentionedStaff}`;
                  }

                  return (
                    <TableRow key={ann.id || ann._id} hover>
                      <TableCell sx={{ fontWeight: '600', color: '#2d3748' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AnnouncementIcon style={{ color: '#3182ce', fontSize: '20px' }} />
                          {ann.title}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#4a5568', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ann.description}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={mentionLabel}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontWeight: '600',
                            borderColor: ann.mentionType === 'all' ? '#93c5fd' : ann.mentionType === 'department' ? '#c084fc' : '#fbcfe8',
                            color: ann.mentionType === 'all' ? '#1d4ed8' : ann.mentionType === 'department' ? '#7e22ce' : '#be185d',
                            bgcolor: ann.mentionType === 'all' ? '#eff6ff' : ann.mentionType === 'department' ? '#f5f3ff' : '#fdf2f8'
                          }}
                        />
                      </TableCell>
                      <TableCell color="textSecondary">
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          {formattedDate}
                          {daysLeft !== null && (
                            <Chip
                              label={daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                              size="small"
                              sx={{
                                bgcolor: daysLeft < 0 ? '#FEF2F2' : '#FFFBEB',
                                color: daysLeft < 0 ? '#DC2626' : '#D97706',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 20
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#718096' }}>
                        @{ann.createdBy || 'System'}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          {canUpdate && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenEditModal(ann)} sx={{ color: '#4a5568' }}>
                                <EditIcon size={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDelete(ann)} sx={{ color: '#e53e3e' }}>
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
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem', pb: 1, color: '#333' }}>
          {editingAnnouncement ? 'Edit Announcement' : 'Publish Announcement'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Title"
              variant="outlined"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Server Maintenance Notice"
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              required
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about the announcement..."
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel shrink>Mention Target</InputLabel>
                <Select
                  value={mentionType}
                  onChange={(e) => setMentionType(e.target.value)}
                  label="Mention Target"
                  displayEmpty
                >
                  <MenuItem value="all">All Staffs</MenuItem>
                  <MenuItem value="department">Specific Department</MenuItem>
                  <MenuItem value="staff">Specific Staff Member</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Target Date (Optional)"
                type="date"
                variant="outlined"
                fullWidth
                value={date}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            </Box>

            {mentionType === 'department' && (
              <FormControl fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel shrink>Select Department</InputLabel>
                <Select
                  value={mentionedDepartment}
                  onChange={(e) => setMentionedDepartment(e.target.value)}
                  label="Select Department"
                >
                  <MenuItem value="">-- Select Department --</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept.id || dept._id} value={dept.id || dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {mentionType === 'staff' && (
              <FormControl fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel shrink>Select Staff Username</InputLabel>
                <Select
                  value={mentionedStaff}
                  onChange={(e) => setMentionedStaff(e.target.value)}
                  label="Select Staff Username"
                >
                  <MenuItem value="">-- Select Username --</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id || u._id} value={u.username}>
                      @{u.username} ({u.firstName} {u.lastName})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
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
              {submitting ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Announcements;
