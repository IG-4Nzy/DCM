import React, { useState, useEffect, useRef } from 'react';
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
  Slider,
  Button,
  LinearProgress,
  Chip
} from '@mui/material';
import { MdNotificationsActive, MdRefresh, MdVolumeUp, MdVolumeMute, MdPlayArrow } from 'react-icons/md';
import request from '../../services/request';
import { useToast } from '../../contexts/ToastContext';
import dayjs from 'dayjs';

interface WorkItem {
  id?: string;
  _id?: string;
  workName: string;
  assignee: string;
  status: string;
  priority: string;
  createdAt: string;
}

const playBeep = (volume: number = 0.5) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch clear beep
    
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); // fade out over 0.15s
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.error('Failed to play beep sound:', e);
  }
};

const NotificationTriggering: React.FC = () => {
  const canView = hasPrivilege(PRIVILEGES.NOTIFICATION_TRIGGERING_VIEW);
  const dispatch = useDispatch<AppDispatch>();
  const { users } = useSelector((state: RootState) => state?.users || { users: [] });
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [countdown, setCountdown] = useState(30);
  const [newAlerts, setNewAlerts] = useState<string[]>([]); // Track newly added work IDs to highlight
  
  const knownWorkIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const { showToast } = useToast();

  const fetchPendingWorks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await request.get('/api/works', {
        params: {
          skip: 0,
          limit: 100,
          status: 'Pending'
        }
      });
      
      const pendingList: WorkItem[] = res.data.data || [];
      const currentIds = pendingList.map(w => (w.id || w._id || ''));
      
      if (isInitialLoadRef.current) {
        // First load: just memorize existing pending works without playing beep
        knownWorkIdsRef.current = new Set(currentIds);
        isInitialLoadRef.current = false;
      } else {
        // Subsequent loads: check for any new work IDs
        let foundNew = false;
        const freshAlerts: string[] = [];
        
        currentIds.forEach(id => {
          if (id && !knownWorkIdsRef.current.has(id)) {
            knownWorkIdsRef.current.add(id);
            freshAlerts.push(id);
            foundNew = true;
          }
        });
        
        if (foundNew) {
          setNewAlerts(prev => [...prev, ...freshAlerts]);
          if (soundEnabled) {
            playBeep(volume);
          }
          showToast(`New pending work detected!`, 'info');
        }
      }
      
      setWorks(pendingList);
    } catch (err) {
      console.error('Failed to fetch pending works', err);
      if (!silent) showToast('Failed to load pending works', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      dispatch(fetchUsers({
        pagination: false,
        showToast: undefined
      }));
      fetchPendingWorks();
    }
  }, [dispatch, canView]);

  // Countdown timer for 30 seconds refresh
  useEffect(() => {
    if (!canView) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchPendingWorks(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [soundEnabled, volume, canView]);

  const handleManualRefresh = () => {
    setCountdown(30);
    fetchPendingWorks();
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
            <MdNotificationsActive style={{ color: '#e53e3e' }} />
            Notification Triggering Panel
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Automated monitoring system for pending works. Refreshes every 30 seconds and plays an audio alert when new works are added.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
              NEXT REFRESH IN
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#3182ce' }}>
              {countdown}s
            </Typography>
          </Box>
          <Tooltip title="Refresh Now">
            <IconButton onClick={handleManualRefresh} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <MdRefresh />
            </IconButton>
          </Tooltip>
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

      {/* Control Configuration Widgets */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748', borderBottom: '1px solid #edf2f7', pb: 1.5 }}>
            Alert Preferences
          </Typography>

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
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>Audio Beep Alert</Typography>
                <Typography variant="caption" color="textSecondary">
                  Play sound when new works are added
                </Typography>
              </Box>
            }
          />

          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#4a5568', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              {volume === 0 ? <MdVolumeMute /> : <MdVolumeUp />}
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

          <Button
            variant="outlined"
            startIcon={<MdPlayArrow />}
            onClick={handleTestBeep}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              mt: 1,
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
          
          <Typography variant="caption" color="textSecondary" sx={{ bgcolor: '#f7fafc', p: 1.5, borderRadius: 2, border: '1px dashed #e2e8f0', textAlign: 'center' }}>
            🔔 <strong>Browser Audio Policy Note</strong>: You must click the page (or click "Test Sound Alert") at least once to authorize audio playback permissions.
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', pb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2d3748' }}>
              Pending Works List
            </Typography>
            <Chip 
              label={`${works.length} Pending`} 
              color="error" 
              size="small" 
              sx={{ fontWeight: 'bold', bgcolor: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }} 
            />
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress size={35} />
            </Box>
          ) : works.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                No pending works found. All clear! 🎉
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 350 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f7fafc', color: '#4a5568' }}>Work Title</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f7fafc', color: '#4a5568' }}>Assignee</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f7fafc', color: '#4a5568' }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f7fafc', color: '#4a5568' }}>Created At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {works.map((work) => {
                    const id = work.id || work._id || '';
                    const isNew = newAlerts.includes(id);
                    
                    return (
                      <TableRow 
                        key={id} 
                        hover
                        sx={{
                          transition: 'background-color 0.5s ease',
                          backgroundColor: isNew ? '#fffaf0' : 'inherit',
                          borderLeft: isNew ? '4px solid #dd6b20' : 'none'
                        }}
                      >
                        <TableCell sx={{ fontWeight: '500', color: '#2d3748' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {work.workName}
                            {isNew && (
                              <Chip
                                label="NEW"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  color: '#fff',
                                  background: 'linear-gradient(135deg, #ed8936 0%, #e53e3e 100%)',
                                  borderRadius: '4px'
                                }}
                              />
                            )}
                          </Box>
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
                              height: 20,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              bgcolor: work.priority === 'High' ? '#fed7d7' : work.priority === 'Medium' ? '#feebc8' : '#e6fffa',
                              color: work.priority === 'High' ? '#9b2c2c' : work.priority === 'Medium' ? '#9c4221' : '#234e52',
                              borderRadius: '4px'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#718096', fontSize: '0.8rem' }}>
                          {work.createdAt ? dayjs(work.createdAt).format('DD-MM-YYYY HH:mm') : '--'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default NotificationTriggering;
