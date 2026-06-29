// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { 
  Box, Button, Card, Grid, Typography, IconButton, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Checkbox, FormControlLabel, Select, MenuItem, InputLabel, FormControl,
  TextField as MuiTextField, Tooltip
} from '@mui/material';
import { 
  MdAdd as AddIcon, 
  MdDelete as DeleteIcon, 
  MdEdit as EditIcon, 
  MdCheckCircle as CheckIcon,
  MdError as ErrorIcon,
  MdSync as RefreshIcon,
  MdVolumeUp as VolumeUpIcon, 
  MdVolumeOff as VolumeOffIcon,
  MdUploadFile as UploadIcon,
  MdClose as ClearIcon
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { 
  fetchMonitoredServers, createMonitoredServer, updateMonitoredServer, deleteMonitoredServer,
  fetchDashboardData, fetchPingDropLogs, exportPingDropLogs
} from './action';
import styles from './index.module.scss';

interface MonitoredServer {
  id: string;
  name: string;
  ipAddress: string;
  adminName?: string;
  monitoringType: 'ping' | 'port' | 'both' | 'heartbeat';
  interval: number;
  timeout: number;
  retryCount: number;
  ports: number[];
  status: 'UP' | 'DOWN';
  pingStatus: 'UP' | 'DOWN';
  portsStatus: Record<string, 'UP' | 'DOWN'>;
  responseTimeMs: number;
  availabilityPct: number;
  isEnabled: boolean;
  lastUpdated: string;
  lastFailedTime?: string;
}

const ServerPingMonitoring: React.FC = () => {
  const { privileges = [], isSuperuser } = useSelector((state: RootState) => state.auth);
  
  // Permissions
  const canView = privileges.includes("View Server Ping Monitoring") || isSuperuser;
  const canCreate = privileges.includes("Create Server Ping Monitoring") || isSuperuser;
  const canUpdate = privileges.includes("Update Server Ping Monitoring") || isSuperuser;
  const canDelete = privileges.includes("Delete Server Ping Monitoring") || isSuperuser;

  // Sound States (Persistent)
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dcm_alert_muted') === 'true');
  const [audioFileName, setAudioFileName] = useState(() => localStorage.getItem('dcm_alert_audio_name') || '');
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for tracking transitions of offline servers
  const prevOfflineServersRef = useRef<string[]>([]);
  const isFirstLoadRef = useRef(true);

  // Dashboard Data
  const [metrics, setMetrics] = useState({ total: 0, online: 0, offline: 0 });

  // Server List States
  const [servers, setServers] = useState<MonitoredServer[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastUpdated');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  // Ping Drop Logs States
  const [dropLogs, setDropLogs] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal forms
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>('');
  const [editingServer, setEditingServer] = useState<MonitoredServer | null>(null);
  const [serverForm, setServerForm] = useState({
    name: '',
    ipAddress: '',
    adminName: '',
    monitoringType: 'ping',
    interval: 60,
    timeout: 5,
    retryCount: 3,
    portsInput: '',
    isEnabled: true
  });

  const [loading, setLoading] = useState(false);

  // Web Audio fallback synthesizer
  const playAlertBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Web Audio beep issue:", e);
    }
  };

  // Play alert trigger
  const triggerAlarmSound = () => {
    const customAudioData = localStorage.getItem('dcm_alert_audio');
    if (customAudioData) {
      const audio = new Audio(customAudioData);
      audio.play().catch(e => {
        console.warn("Custom audio playback blocked, playing synthesizer beep instead:", e);
        playAlertBeep();
      });
    } else {
      playAlertBeep();
    }
  };

  // Sound Loop management
  useEffect(() => {
    const hasOfflineServers = metrics.offline > 0 || servers.some(s => 
      s.status === 'DOWN' || 
      ((s.monitoringType === 'both' || s.monitoringType === 'port') && 
       s.portsStatus && 
       Object.values(s.portsStatus).includes('DOWN'))
    );

    if (hasOfflineServers && !isMuted) {
      if (!audioIntervalRef.current) {
        triggerAlarmSound();
        audioIntervalRef.current = setInterval(() => {
          triggerAlarmSound();
        }, 3000); // Play alarm sound every 3 seconds
      }
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    }

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    };
  }, [metrics.offline, servers, isMuted]);

  // Load dashboard metrics
  const loadDashboardMetrics = async () => {
    try {
      const dbData = await fetchDashboardData();
      setMetrics({
        total: dbData.metrics.total,
        online: dbData.metrics.online,
        offline: dbData.metrics.offline
      });
    } catch (err) {
      console.error("Failed loading dashboard metrics:", err);
    }
  };

  // Load monitored servers list (no pagination)
  const loadServers = async () => {
    try {
      setLoading(true);
      const data = await fetchMonitoredServers({
        skip: 0,
        limit: 1000,
        search,
        sortBy,
        order
      });
      const loadedServers = data.data || [];
      setServers(loadedServers);

      // Track newly offline servers to automatically trigger sound/unmute
      const currentOfflineIds = loadedServers.filter((s: MonitoredServer) => s.status === 'DOWN').map((s: MonitoredServer) => s.id);
      
      if (isFirstLoadRef.current) {
        prevOfflineServersRef.current = currentOfflineIds;
        isFirstLoadRef.current = false;
      } else {
        const hasNewOffline = currentOfflineIds.some((id: any) => !prevOfflineServersRef.current.includes(id));
        if (hasNewOffline) {
          // Unmute when another server drops ping
          setIsMuted(false);
          localStorage.setItem('dcm_alert_muted', 'false');
        }
        prevOfflineServersRef.current = currentOfflineIds;
      }
    } catch (err) {
      console.error("Failed loading monitored servers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load log events (no pagination)
  const loadLogs = async () => {
    try {
      const res = await fetchPingDropLogs({
        skip: 0,
        limit: 1000,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setDropLogs(res.data || []);
    } catch (err) {
      console.error("Failed loading ping drop logs:", err);
    }
  };

  // Initial load
  useEffect(() => {
    if (canView) {
      loadDashboardMetrics();
      loadServers();
    }
  }, [canView, search, sortBy, order]);

  // Load logs when modal opens or date filters change
  useEffect(() => {
    if (isLogsModalOpen && canView) {
      loadLogs();
    }
  }, [isLogsModalOpen, startDate, endDate]);

  // Auto refresh data every 10 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (canView) {
      interval = setInterval(() => {
        loadDashboardMetrics();
        loadServers();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [canView, search, sortBy, order]);

  if (!canView) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">Access Denied</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>You do not have privilege to view Server Ping Monitoring.</Typography>
      </Box>
    );
  }

  // Handle Mute toggle
  const handleToggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    localStorage.setItem('dcm_alert_muted', String(newMuteState));
  };

  // Handle Audio File upload (converts to base64 Data URL and saves to localStorage)
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert("Please upload a valid audio file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      try {
        localStorage.setItem('dcm_alert_audio', dataUrl);
        localStorage.setItem('dcm_alert_audio_name', file.name);
        setAudioFileName(file.name);
        alert(`Successfully uploaded custom alarm sound: ${file.name}`);
      } catch (err) {
        alert("The audio file is too large to store in local storage. Please choose a smaller file (< 4MB).");
      }
    };
    reader.readAsDataURL(file);
  };

  // Clear uploaded audio
  const handleClearAudio = () => {
    localStorage.removeItem('dcm_alert_audio');
    localStorage.removeItem('dcm_alert_audio_name');
    setAudioFileName('');
    alert("Alert sound reset to default synthesizer beep.");
  };

  // Handle CSV Export download
  const handleExportLogs = async () => {
    try {
      const blob = await exportPingDropLogs({
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `server_ping_drops_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert("Failed to export ping drop logs to CSV");
    }
  };

  // Open register/edit server modal
  const handleOpenServerModal = (srv: MonitoredServer | null = null) => {
    if (srv) {
      setEditingServer(srv);
      setServerForm({
        name: srv.name,
        ipAddress: srv.ipAddress,
        adminName: srv.adminName || '',
        monitoringType: srv.monitoringType,
        interval: srv.interval,
        timeout: srv.timeout,
        retryCount: srv.retryCount,
        portsInput: srv.ports.join(', '),
        isEnabled: srv.isEnabled
      });
    } else {
      setEditingServer(null);
      setServerForm({
        name: '',
        ipAddress: '',
        adminName: '',
        monitoringType: 'ping',
        interval: 60,
        timeout: 5,
        retryCount: 3,
        portsInput: '',
        isEnabled: true
      });
    }
    setIsServerModalOpen(true);
  };

  // Handle server form submit
  const handleServerFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ports = serverForm.portsInput
      .split(',')
      .map(p => parseInt(p.trim()))
      .filter(p => !isNaN(p));

    const payload = {
      name: serverForm.name,
      ipAddress: serverForm.ipAddress,
      adminName: serverForm.adminName || undefined,
      monitoringType: serverForm.monitoringType,
      interval: Number(serverForm.interval),
      timeout: Number(serverForm.timeout),
      retryCount: Number(serverForm.retryCount),
      ports,
      isEnabled: serverForm.isEnabled
    };

    try {
      if (editingServer) {
        await updateMonitoredServer(editingServer.id, payload);
      } else {
        await createMonitoredServer(payload);
      }
      setIsServerModalOpen(false);
      loadServers();
      loadDashboardMetrics();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save monitored server config");
    }
  };

  // Trigger custom confirmation modal
  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
  };

  // Perform backend deletion after confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteMonitoredServer(deleteTargetId);
      setDeleteTargetId(null);
      await loadServers();
      await loadDashboardMetrics();
    } catch (err: any) {
      alert("Failed deleting monitored server config: " + (err.response?.data?.detail || err.message || err));
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header Row (Extremely compact, with metrics side-by-side) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Server Ping Monitoring
          </Typography>
          {/* Integrated Metrics Inline Pills */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip size="small" label={`Total: ${metrics.total}`} variant="outlined" sx={{ fontWeight: 700 }} />
            <Chip size="small" label={`Online: ${metrics.online}`} color="success" sx={{ fontWeight: 700, bgcolor: '#e6f4ea', color: '#137333' }} />
            <Chip size="small" label={`Offline: ${metrics.offline}`} color="error" sx={{ fontWeight: 700, bgcolor: '#fce8e6', color: '#c5221f' }} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Persistent Mute Toggle button */}
          <Tooltip title={isMuted ? "Unmute Alarm Sound" : "Mute Alarm Sound"}>
            <IconButton 
              onClick={handleToggleMute} 
              size="small"
              sx={{ 
                border: '1px solid', 
                borderColor: isMuted ? '#cbd5e1' : '#fecaca', 
                background: isMuted ? '#f8fafc' : '#fef2f2',
                color: isMuted ? '#64748b' : '#ef4444'
              }}
            >
              {isMuted ? <VolumeOffIcon size={18} /> : <VolumeUpIcon size={18} />}
            </IconButton>
          </Tooltip>

          {/* Audio Upload Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleAudioUpload} 
              style={{ display: 'none' }} 
              id="audio-upload-input" 
            />
            <label htmlFor="audio-upload-input">
              <Button 
                component="span" 
                variant="outlined" 
                startIcon={<UploadIcon />}
                size="small"
                sx={{ borderRadius: '6px', textTransform: 'none', height: '30px', fontSize: '0.8rem' }}
              >
                {audioFileName ? `${audioFileName.substring(0, 10)}...` : 'Upload Alarm'}
              </Button>
            </label>
            {audioFileName && (
              <IconButton onClick={handleClearAudio} size="small" sx={{ color: '#ef4444' }}>
                <ClearIcon size={14} />
              </IconButton>
            )}
          </Box>

          <Button 
            variant="outlined" 
            size="small"
            onClick={() => setIsLogsModalOpen(true)}
            sx={{ borderRadius: '6px', textTransform: 'none', height: '30px', fontSize: '0.8rem', borderColor: '#f59e0b', color: '#f59e0b' }}
          >
            Drop Logs
          </Button>

          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            size="small"
            onClick={() => {
              loadDashboardMetrics();
              loadServers();
            }}
            sx={{ borderRadius: '6px', textTransform: 'none', height: '30px', fontSize: '0.8rem' }}
          >
            Refresh
          </Button>

          {canCreate && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              size="small"
              onClick={() => handleOpenServerModal()}
              sx={{ borderRadius: '6px', textTransform: 'none', background: '#3b82f6', '&:hover': { background: '#2563eb' }, height: '30px', fontSize: '0.8rem' }}
            >
              Add Server
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Table Card (Highly compact, no pagination, removed status filter) */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: 'none' }}>
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
            Monitored Servers Health
          </Typography>
          <MuiTextField 
            size="small" 
            placeholder="Search Server or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 200, '& .MuiOutlinedInput-root': { borderRadius: '6px', height: '30px', fontSize: '0.85rem' } }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Server Name</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Admin Name</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Latency</TableCell>

                <TableCell sx={{ fontWeight: 700, py: 1 }}>Ping Dropped Time</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Last Check</TableCell>
                {canUpdate || canDelete ? <TableCell sx={{ fontWeight: 700, py: 1 }} align="center">Actions</TableCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {servers.map((srv) => (
                <TableRow key={srv.id} hover>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>{srv.name}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{srv.ipAddress}</TableCell>
                  <TableCell sx={{ color: '#475569', fontWeight: 500, py: 0.75 }}>{srv.adminName || '--'}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip 
                      size="small" 
                      label={srv.monitoringType.toUpperCase()} 
                      color="info" 
                      variant="outlined" 
                      sx={{ fontWeight: 600, fontSize: '0.68rem', height: '20px' }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <span className={`${styles.container__statusChip} ${styles[srv.status]}`} style={{ padding: '2px 8px', fontSize: '0.7rem', width: 'fit-content' }}>
                        {srv.status === 'UP' && <CheckIcon size={12} />}
                        {srv.status === 'DOWN' && <ErrorIcon size={12} />}
                        {srv.status}
                      </span>
                      {srv.monitoringType === 'both' && srv.portsStatus && Object.keys(srv.portsStatus).length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                          {Object.entries(srv.portsStatus).map(([port, status]) => (
                            <Tooltip key={port} title={`Port ${port}: ${status}`}>
                              <Chip
                                size="small"
                                label={`${port}:${status}`}
                                sx={{
                                  fontSize: '0.62rem',
                                  height: '16px',
                                  px: 0.5,
                                  fontWeight: 600,
                                  color: status === 'UP' ? '#15803d' : '#b91c1c',
                                  bgcolor: status === 'UP' ? '#f0fdf4' : '#fef2f2',
                                  border: `1px solid ${status === 'UP' ? '#bbf7d0' : '#fca5a5'}`,
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    {srv.status === 'DOWN' ? '--' : `${srv.responseTimeMs} ms`}
                  </TableCell>

                  <TableCell sx={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500, py: 0.75 }}>
                    {srv.lastFailedTime ? new Date(srv.lastFailedTime).toLocaleString() : '--'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: '#64748b', py: 0.75 }}>
                    {srv.lastUpdated ? new Date(srv.lastUpdated).toLocaleTimeString() : '--'}
                  </TableCell>
                  {canUpdate || canDelete ? (
                    <TableCell align="center" sx={{ py: 0.75 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {canUpdate && (
                          <IconButton size="small" onClick={() => handleOpenServerModal(srv)} sx={{ color: '#3b82f6', p: 0.5 }}>
                            <EditIcon size={16} />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton size="small" onClick={() => handleDeleteClick(srv.id, srv.name)} sx={{ color: '#ef4444', p: 0.5 }}>
                            <DeleteIcon size={16} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {servers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                    No monitored servers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Ping Drop Logs Modal */}
      <Modal
        open={isLogsModalOpen}
        handleClose={() => setIsLogsModalOpen(false)}
        title="Ping Drop Event Logs"
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          <MuiTextField
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { height: '30px', fontSize: '0.8rem' } }}
          />
          <MuiTextField
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { height: '30px', fontSize: '0.8rem' } }}
          />
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            size="small"
            onClick={handleExportLogs}
            sx={{ borderRadius: '6px', textTransform: 'none', background: '#10b981', '&:hover': { background: '#059669' }, height: '30px', fontSize: '0.8rem' }}
          >
            Export CSV
          </Button>
        </Box>

        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Server Name</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Admin Name</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Ping Dropped Time</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Failure Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dropLogs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>{log.name}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{log.ipAddress}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{log.adminName || '--'}</TableCell>
                  <TableCell sx={{ color: '#ef4444', fontWeight: 500, py: 0.75, fontSize: '0.75rem' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip size="small" label={log.pingStatus} color="error" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem', height: '18px' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: '#475569', py: 0.75 }}>{log.reason}</TableCell>
                </TableRow>
              ))}
              {dropLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#64748b' }}>
                    No ping drop logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Modal>

      {/* Register/Edit Server Modal */}
      <Modal
        open={isServerModalOpen}
        handleClose={() => setIsServerModalOpen(false)}
        title={editingServer ? "Edit Monitored Server" : "Register Monitored Server"}
      >
        <form onSubmit={handleServerFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <TextField
            label="Server Friendly Name"
            value={serverForm.name}
            onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="IP Address or FQDN"
            value={serverForm.ipAddress}
            onChange={(e) => setServerForm({ ...serverForm, ipAddress: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Admin Name"
            value={serverForm.adminName}
            onChange={(e) => setServerForm({ ...serverForm, adminName: e.target.value })}
            placeholder="Enter responsible admin name"
            fullWidth
          />
          <FormControl fullWidth size="small">
            <InputLabel>Monitoring Type</InputLabel>
            <Select
              value={serverForm.monitoringType}
              label="Monitoring Type"
              onChange={(e) => setServerForm({ ...serverForm, monitoringType: e.target.value })}
              sx={{ borderRadius: '6px' }}
            >
              <MenuItem value="ping">ICMP Ping Only</MenuItem>
              <MenuItem value="port">TCP Port Only</MenuItem>
              <MenuItem value="both">Ping + Port Monitoring</MenuItem>
              <MenuItem value="heartbeat">Heartbeat Agent</MenuItem>
            </Select>
          </FormControl>
          
          {(serverForm.monitoringType === 'port' || serverForm.monitoringType === 'both') && (
            <TextField
              label="TCP Target Ports (comma-separated, e.g. 22, 80, 443)"
              value={serverForm.portsInput}
              onChange={(e) => setServerForm({ ...serverForm, portsInput: e.target.value })}
              placeholder="e.g. 22, 80, 443"
              fullWidth
            />
          )}

          <Grid container spacing={1.5}>
            <Grid size={{xs: 4}}  >
              <TextField
                label="Interval (s)"
                type="number"
                value={serverForm.interval}
                onChange={(e) => setServerForm({ ...serverForm, interval: Number(e.target.value) })}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{xs: 4}}  >
              <TextField
                label="Timeout (s)"
                type="number"
                value={serverForm.timeout}
                onChange={(e) => setServerForm({ ...serverForm, timeout: Number(e.target.value) })}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{xs: 4}}  >
              <TextField
                label="Retry Count"
                type="number"
                value={serverForm.retryCount}
                onChange={(e) => setServerForm({ ...serverForm, retryCount: Number(e.target.value) })}
                required
                fullWidth
              />
            </Grid>
          </Grid>

          <FormControlLabel
            control={
              <Checkbox
                checked={serverForm.isEnabled}
                onChange={(e) => setServerForm({ ...serverForm, isEnabled: e.target.checked })}
                size="small"
              />
            }
            label={<Typography sx={{ fontSize: '0.85rem' }}>Enable Monitoring Schedule</Typography>}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
            <Button size="small" onClick={() => setIsServerModalOpen(false)}>Cancel</Button>
            <Button size="small" type="submit" variant="contained" sx={{ background: '#3b82f6', '&:hover': { background: '#2563eb' } }}>
              Save Configuration
            </Button>
          </Box>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTargetId)}
        handleClose={() => setDeleteTargetId(null)}
        title="Confirm Deletion"
      >
        <Box sx={{ p: 0.5 }}>
          <Typography sx={{ mb: 2, fontSize: '0.9rem', color: '#1e293b' }}>
            Are you sure you want to stop monitoring and delete the configuration for server <strong>{deleteTargetName}</strong>? This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              onClick={handleConfirmDelete}
              sx={{ background: '#ef4444', '&:hover': { background: '#dc2626' } }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default ServerPingMonitoring;
