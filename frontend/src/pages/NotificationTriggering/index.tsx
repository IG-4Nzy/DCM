// @ts-nocheck
import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
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
  Slider,
  Button,
  LinearProgress,
  Chip,
  Grid
} from '@mui/material';
import { MdNotificationsActive as ActiveIcon, MdVolumeUp as VolumeUpIcon, MdVolumeMute as VolumeMuteIcon, MdPlayArrow as PlayIcon } from 'react-icons/md';
import { useToast } from '../../contexts/ToastContext';
import { useNotificationPoller, playBeep } from '../../contexts/NotificationPollerContext';

const NotificationTriggering: React.FC = () => {
  const { isSuperuser } = useSelector((state: RootState) => state.auth);
  const { users } = useSelector((state: RootState) => state.users || { users: [] });
  const canView = isSuperuser || 
                  hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW) || 
                  hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_DEPT) || 
                  hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW_OWN);

  const { showToast } = useToast();

  const {
    works,
    requests,
    announcements,
    periodicActivities,
    loading,
    countdown,
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    newWorkAlerts,
    newRequestAlerts,
    newAnnouncementAlerts,
    newPeriodicAlerts,
    fetchMonitoredData
  } = useNotificationPoller();

  const handleManualRefresh = () => {
    fetchMonitoredData();
  };

  const handleTestBeep = () => {
    playBeep(volume);
    showToast('Test beep triggered successfully!', 'success');
  };

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', py: 10, color: '#64748b' }}>
        <Typography variant="h5" sx={{ color: '#334155', mb: 1, fontWeight: 'bold' }}>
          Access Restricted
        </Typography>
        <Typography variant="body2">
          You need the View Notification Triggering privilege to access this feature.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ActiveIcon style={{ color: '#e53e3e' }} />
            Notification Triggering Panel
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Automated monitoring system. Refreshes every 30 seconds and plays an audio alert when new works, requests, announcements or periodic activities are added.
          </Typography>
        </Box>
      </Box>

      {/* Progress bar count down */}
      <Box sx={{ width: '100%', mt: -2 }}>
        <LinearProgress
          variant="determinate"
          value={(countdown / 30) * 100}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: '#e2e8f0',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              transition: 'transform 1s linear',
              bgcolor: countdown <= 5 ? '#e53e3e' : '#3182ce'
            }
          }}
        />
      </Box>

      {/* Preferences Widget */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>Audio Alert</Typography>
                <Typography variant="caption" color="textSecondary">
                  Play sound when new items are added
                </Typography>
              </Box>
            }
          />

          <Box sx={{ width: 250 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#4a5568', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              {volume === 0 ? <VolumeMuteIcon /> : <VolumeUpIcon />}
              Volume Control: {Math.round(volume * 100)}%
            </Typography>
            <Slider
              value={volume}
              min={0}
              max={1}
              step={0.05}
              onChange={(_, val) => setVolume(val as number)}
              disabled={!soundEnabled}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<PlayIcon />}
            onClick={handleTestBeep}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#cbd5e0',
              color: '#4a5568',
              '&:hover': {
                borderColor: '#4a5568',
                bgcolor: '#f7fafc'
              }
            }}
          >
            Test Sound Alert
          </Button>
          <Typography variant="caption" color="textSecondary" sx={{ bgcolor: '#f7fafc', p: 1, borderRadius: 2, border: '1px dashed #e2e8f0', maxWidth: 300 }}>
            🔔 Please click the page at least once to authorize audio.
          </Typography>
        </Box>
      </Paper>

      {/* Main 4-Grid Monitoring Boards */}
      <Grid container spacing={3}>

        {/* Card 1: Pending Works */}
        <Grid size={{xs: 12, md: 6}}   >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              minHeight: 350
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', pb: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748' }}>
                🛠️  Active Works
              </Typography>
              <Chip label="Last 5" color="primary" size="small" variant="outlined" />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={30} />
              </Box>
            ) : works.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">No active works found.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Assignee</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {works.map((work) => {
                      const id = work.id || work._id || '';
                      const isNew = newWorkAlerts.includes(id);
                      return (
                        <TableRow key={id} hover sx={{ backgroundColor: isNew ? '#fffaf0' : 'inherit' }}>
                          <TableCell sx={{ fontWeight: '500', color: '#2d3748' }}>
                            {work.workName}
                            {isNew && <Chip label="NEW" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem', ml: 1 }} />}
                          </TableCell>
                          <TableCell sx={{ color: '#4a5568' }}>
                            {(() => {
                              if (!work.assignee) return 'Unassigned';
                              const user = users.find((u: any) => u.id === work.assignee || u._id === work.assignee || u.username === work.assignee);
                              return user ? `@${user.username}` : `@${work.assignee}`;
                            })()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={work.priority}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: work.priority === 'High' ? '#fed7d7' : '#e6fffa',
                                color: work.priority === 'High' ? '#9b2c2c' : '#234e52'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={work.status || 'Pending'}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: work.status === 'In Progress' ? '#e0f2fe' : '#f3f4f6',
                                color: work.status === 'In Progress' ? '#0369a1' : '#4b5563'
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
          </Paper>
        </Grid>



        {/* Card 3: Announcements */}
        <Grid size={{xs: 12, md: 6}}   >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              minHeight: 350
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', pb: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748' }}>
                📢  Announcements
              </Typography>
              <Chip label="Last 5" color="success" size="small" variant="outlined" />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={30} />
              </Box>
            ) : announcements.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">No announcements found.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Dept</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Mention</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {announcements.map((ann) => {
                      const id = ann.id || ann._id || '';
                      const isNew = newAnnouncementAlerts.includes(id);
                      return (
                        <TableRow key={id} hover sx={{ backgroundColor: isNew ? '#f0fdf4' : 'inherit' }}>
                          <TableCell sx={{ fontWeight: '500', color: '#2d3748' }}>
                            {ann.title}
                            {isNew && <Chip label="NEW" size="small" color="success" sx={{ height: 16, fontSize: '0.6rem', ml: 1 }} />}
                          </TableCell>
                          <TableCell sx={{ color: '#4a5568' }}>{ann.department || 'All'}</TableCell>
                          <TableCell sx={{ color: '#4a5568', textTransform: 'capitalize' }}>
                            {ann.mentionType}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Card 4: Periodic Activities */}
        <Grid size={{xs: 12, md: 6}}   >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              minHeight: 350
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', pb: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748' }}>
                📅  Periodic Activities
              </Typography>
              <Chip label="Last 5" color="warning" size="small" variant="outlined" />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={30} />
              </Box>
            ) : periodicActivities.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">No periodic activities found.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Dept</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Due Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periodicActivities.map((act) => {
                      const id = act.id || act._id || '';
                      const isNew = newPeriodicAlerts.includes(id);
                      return (
                        <TableRow key={id} hover sx={{ backgroundColor: isNew ? '#fffbeb' : 'inherit' }}>
                          <TableCell sx={{ fontWeight: '500', color: '#2d3748' }}>
                            {act.name}
                            {isNew && <Chip label="NEW" size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem', ml: 1 }} />}
                          </TableCell>
                          <TableCell sx={{ color: '#4a5568' }}>{act.department || 'All'}</TableCell>
                          <TableCell sx={{ color: '#e53e3e', fontWeight: 600 }}>{act.dueDate}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>


        {/* Card 2: Requests */}
        <Grid size={{xs: 12, md: 6}}   >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              minHeight: 350
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', pb: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748' }}>
                📥  Requests
              </Typography>
              <Chip label="Last 5" color="secondary" size="small" variant="outlined" />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={30} />
              </Box>
            ) : requests.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">No requests found.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Created By</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Assignee</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4a5568' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((req) => {
                      const id = req.id || req._id || '';
                      const isNew = newRequestAlerts.includes(id);
                      return (
                        <TableRow key={id} hover sx={{ backgroundColor: isNew ? '#fdf2f8' : 'inherit' }}>
                          <TableCell sx={{ fontWeight: '500', color: '#2d3748' }}>
                            {req.requestType}
                            {isNew && <Chip label="NEW" size="small" color="secondary" sx={{ height: 16, fontSize: '0.6rem', ml: 1 }} />}
                          </TableCell>
                          <TableCell sx={{ color: '#4a5568' }}>@{req.createdBy}</TableCell>
                          <TableCell sx={{ color: '#4a5568' }}>
                            {(() => {
                              const assignees = req.currentAssignedUsers || [];
                              if (assignees.length === 0) return 'Unassigned';
                              return assignees.map((a: string) => `@${a}`).join(', ');
                            })()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={req.status}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: req.status === 'Pending' ? '#feebc8' : '#e2e8f0',
                                color: req.status === 'Pending' ? '#9c4221' : '#4a5568'
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
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NotificationTriggering;
