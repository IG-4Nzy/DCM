// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { Box, Button, Card, Grid, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Checkbox, FormControlLabel, Select, MenuItem, InputLabel, FormControl, TextField as MuiTextField, Tooltip } from '@mui/material';
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
  MdClose as ClearIcon,
  MdNotificationsActive as NotificationsActiveIcon,
  MdNotificationsOff as NotificationsOffIcon
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import request, { API_BASE_URL } from '../../services/request';
import { 
  fetchMonitoredServers, createMonitoredServer, updateMonitoredServer, deleteMonitoredServer,
  fetchDashboardData, fetchPingDropLogs, exportPingDropLogs, acknowledgeServer
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
  isAcknowledged?: boolean;
  lastUpdated: string;
  lastFailedTime?: string;
}

// Shared AudioContext to prevent memory leaks from multiple AudioContext instances
let sharedAudioContext: AudioContext | null = null;

const getSharedAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioContext = new AudioContextClass();
      }
    }
  } catch (err) {
    console.error("Failed to create AudioContext:", err);
  }
  return sharedAudioContext;
};

if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    const audioCtx = getSharedAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(err => console.warn("Failed to resume AudioContext:", err));
    }
  };
  window.addEventListener('click', resumeAudio, { capture: true, passive: true });
  window.addEventListener('keydown', resumeAudio, { capture: true, passive: true });
}

// LocalStorage helpers to prevent security or quota exceptions from crashing
const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn("Failed to read from localStorage:", err);
    return null;
  }
};

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }
};

// Safe stop audio helper to prevent InvalidStateError / DOMException on currentTime manipulation
const safeStopAudio = (audio: HTMLAudioElement | null) => {
  if (!audio) return;
  try {
    audio.pause();
    if (audio.readyState > 0 && isFinite(audio.duration)) {
      audio.currentTime = 0;
    }
  } catch (err) {
    console.warn("Failed to stop audio safely:", err);
  }
};

// Defensive helper to extract port status entries safely
const getPortsStatusEntries = (portsStatus: any): [string, 'UP' | 'DOWN'][] => {
  if (portsStatus && typeof portsStatus === 'object' && !Array.isArray(portsStatus)) {
    return Object.entries(portsStatus);
  }
  return [];
};

// Defensive helper to check for offline ports safely
const hasOfflinePorts = (srv: MonitoredServer | null | undefined): boolean => {
  if (!srv || !srv.portsStatus || typeof srv.portsStatus !== 'object' || Array.isArray(srv.portsStatus)) {
    return false;
  }
  return Object.values(srv.portsStatus).includes('DOWN');
};

// Safe date formatting helpers to prevent RangeError or conversion failures
const safeFormatDateTime = (dateStr: any): string => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString();
  } catch {
    return '--';
  }
};

const safeFormatTime = (dateStr: any): string => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString();
  } catch {
    return '--';
  }
};

const ServerPingMonitoring: React.FC = () => {
  const { privileges = [], isSuperuser } = useSelector((state: RootState) => state.auth);
  
  // Permissions
  const canView = privileges.includes("View Server Ping Monitoring") || isSuperuser;
  const canCreate = privileges.includes("Create Server Ping Monitoring") || isSuperuser;
  const canUpdate = privileges.includes("Update Server Ping Monitoring") || isSuperuser;
  const canDelete = privileges.includes("Delete Server Ping Monitoring") || isSuperuser;

  // Sound States (Persistent)
  const [isMuted, setIsMuted] = useState(() => safeGetLocalStorage('dcm_alert_muted') === 'true');
  const [audioFileName, setAudioFileName] = useState('');
  const [customAlarmUrl, setCustomAlarmUrl] = useState<string | null>(null);
  const activeAlarmUrlRef = useRef<string | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);
  const lastAlarmUrlRef = useRef<string | null>(null);

  const updateAlarmUrl = (url: string | null) => {
    activeAlarmUrlRef.current = url;
    setCustomAlarmUrl(url);
  };

  const fetchCustomAlarm = async () => {
    try {
      const res = await request.get('/api/server-ping-monitoring/alarm-sound');
      if (res.data && res.data.filename) {
        const fileRes = await request.get('/api/server-ping-monitoring/alarm-sound/file', {
          responseType: 'blob'
        });
        const blobUrl = URL.createObjectURL(fileRes.data);
        
        if (activeAlarmUrlRef.current && activeAlarmUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(activeAlarmUrlRef.current);
        }
        
        updateAlarmUrl(blobUrl);
        setAudioFileName(res.data.filename || 'custom_alarm.mp3');
      } else {
        if (activeAlarmUrlRef.current && activeAlarmUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(activeAlarmUrlRef.current);
        }
        updateAlarmUrl(null);
        setAudioFileName('');
      }
    } catch (err) {
      console.error("Error fetching custom alarm:", err);
    }
  };

  // Individual Muted Servers State
  const [mutedServerIds, setMutedServerIds] = useState<string[]>(() => {
    try {
      const stored = safeGetLocalStorage('dcm_muted_server_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleToggleMuteServer = (serverId: string) => {
    const nextMuted = mutedServerIds.includes(serverId)
      ? mutedServerIds.filter(id => id !== serverId)
      : [...mutedServerIds, serverId];
    setMutedServerIds(nextMuted);
    safeSetLocalStorage('dcm_muted_server_ids', JSON.stringify(nextMuted));

    // Optimistically check if we should mute the alarm sound immediately
    const hasUnmutedOffline = servers.some(s => {
      if (!s) return false;
      if (!s.isEnabled) return false;
      if (nextMuted.includes(s.id)) return false;
      if (s.isAcknowledged) return false;
      return s.status === 'DOWN' || 
        ((s.monitoringType === 'both' || s.monitoringType === 'port') && hasOfflinePorts(s));
    });

    if (!hasUnmutedOffline || isMuted) {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      safeStopAudio(audioInstanceRef.current);
    }
  };

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
  const [ackTargetServer, setAckTargetServer] = useState<MonitoredServer | null>(null);
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

  const validateServerName = (v: string) => {
    if (!v) return "";
    if (!/^[a-zA-Z0-9\s._-]+$/.test(v)) return "Friendly name must be alphanumeric with spaces, dashes, dots or underscores only";
    if (v.length < 2 || v.length > 50) return "Friendly name must be between 2 to 50 characters";
    return "";
  };
  const validateIpAddress = (v: string) => {
    if (!v) return "";
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipv4Regex.test(v)) return "Must be a valid IPv4 address";
    const parts = v.split('.');
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return "Must be a valid IPv4 address (octets 0-255)";
      }
    }
    return "";
  };
  const validatePortsInput = (v: string) => {
    if (!v) return "";
    const ports = v.split(',').map(p => p.trim());
    for (const p of ports) {
      if (!p) continue;
      const num = parseInt(p, 10);
      if (isNaN(num) || num < 1 || num > 65535) {
        return "Each port must be an integer between 1 and 65535";
      }
    }
    return "";
  };
  const validateInterval = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return "Interval is required";
    if (v < 5 || v > 3600) return "Interval must be between 5 and 3600 seconds";
    return "";
  };
  const validateTimeout = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return "Timeout is required";
    if (v < 1 || v > 30) return "Timeout must be between 1 and 30 seconds";
    return "";
  };
  const validateRetryCount = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return "Retry count is required";
    if (v < 1 || v > 10) return "Retry count must be between 1 and 10";
    return "";
  };

  const nameErr = validateServerName(serverForm.name);
  const ipAddressErr = validateIpAddress(serverForm.ipAddress);
  const portsInputErr = (serverForm.monitoringType === 'port' || serverForm.monitoringType === 'both') ? validatePortsInput(serverForm.portsInput) : "";
  const intervalErr = validateInterval(serverForm.interval);
  const timeoutErr = validateTimeout(serverForm.timeout);
  const retryCountErr = validateRetryCount(serverForm.retryCount);

  const isFormInvalid = !!nameErr || !!ipAddressErr || !!portsInputErr || !!intervalErr || !!timeoutErr || !!retryCountErr || !serverForm.name || !serverForm.ipAddress;

  const [loading, setLoading] = useState(false);

  // Web Audio fallback synthesizer
  const playAlertBeep = () => {
    try {
      const audioCtx = getSharedAudioContext();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.warn("Failed to resume AudioContext in playAlertBeep:", err));
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      // Cleanup Web Audio nodes on completion to prevent memory leaks
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Web Audio beep issue:", e);
    }
  };

  // Sound Loop management
  useEffect(() => {
    const hasUnmutedOfflineServers = servers.some(s => {
      if (!s) return false;
      if (!s.isEnabled) return false;
      if (mutedServerIds.includes(s.id)) return false;
      if (s.isAcknowledged) return false;
      return s.status === 'DOWN' || 
        ((s.monitoringType === 'both' || s.monitoringType === 'port') && hasOfflinePorts(s));
    });

    const shouldPlay = hasUnmutedOfflineServers && !isMuted;

    let interactionCleanup: (() => void) | null = null;

    if (shouldPlay) {
      if (customAlarmUrl) {
        // Clear synth beep interval if running
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
        }

        // Handle custom audio playback
        if (!audioInstanceRef.current || lastAlarmUrlRef.current !== customAlarmUrl) {
          if (audioInstanceRef.current) {
            safeStopAudio(audioInstanceRef.current);
          }
          const audio = new Audio(customAlarmUrl);
          audio.loop = true;
          audioInstanceRef.current = audio;
          lastAlarmUrlRef.current = customAlarmUrl;
        }

        // Play if paused
        if (audioInstanceRef.current.paused) {
          const triggerFallbackBeep = () => {
            if (!audioIntervalRef.current) {
              playAlertBeep();
              audioIntervalRef.current = setInterval(() => {
                playAlertBeep();
              }, 3000);
            }

            // Register one-time user interaction listener to play custom sound once allowed
            const startOnInteraction = () => {
              if (audioInstanceRef.current && audioInstanceRef.current.paused) {
                try {
                  const playPromise = audioInstanceRef.current.play();
                  if (playPromise !== undefined) {
                    playPromise.then(() => {
                      if (audioIntervalRef.current) {
                        clearInterval(audioIntervalRef.current);
                        audioIntervalRef.current = null;
                      }
                    }).catch(err => console.warn("Failed to play custom alarm on interaction:", err));
                  }
                } catch (err) {
                  console.warn("Sync error playing custom alarm on interaction:", err);
                }
              }
              cleanupListeners();
            };

            const cleanupListeners = () => {
              window.removeEventListener('click', startOnInteraction);
              window.removeEventListener('keydown', startOnInteraction);
            };

            window.addEventListener('click', startOnInteraction);
            window.addEventListener('keydown', startOnInteraction);
            interactionCleanup = cleanupListeners;
          };

          try {
            const playPromise = audioInstanceRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                console.warn("Custom audio playback blocked, playing synthesizer beep instead:", e);
                triggerFallbackBeep();
              });
            }
          } catch (e) {
            console.warn("Sync error playing custom alarm:", e);
            triggerFallbackBeep();
          }
        }
      } else {
        // Fallback beep loop (no custom alarm)
        if (audioInstanceRef.current) {
          safeStopAudio(audioInstanceRef.current);
          audioInstanceRef.current = null;
        }

        if (!audioIntervalRef.current) {
          playAlertBeep();
          audioIntervalRef.current = setInterval(() => {
            playAlertBeep();
          }, 3000);
        }
      }
    } else {
      // Stop everything
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      safeStopAudio(audioInstanceRef.current);
    }

    return () => {
      if (interactionCleanup) {
        interactionCleanup();
      }
    };
  }, [servers, isMuted, mutedServerIds, customAlarmUrl]);

  // Clean up audio assets on unmount
  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current = null;
      }
      if (activeAlarmUrlRef.current && activeAlarmUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeAlarmUrlRef.current);
      }
    };
  }, []);

  // Automatically unmute servers that have come back online
  useEffect(() => {
    if (servers.length === 0) return;
    
    let changed = false;
    const nextMutedIds = mutedServerIds.filter(id => {
      const srv = servers.find(s => s.id === id);
      if (!srv) return true; // Keep if not found in list
      
      const isOffline = srv.status === 'DOWN' || 
                        ((srv.monitoringType === 'both' || srv.monitoringType === 'port') && 
                         hasOfflinePorts(srv));
                         
      if (!isOffline) {
        changed = true;
        return false; // Remove from muted list (unmute)
      }
      return true;
    });
    
    if (changed) {
      setMutedServerIds(nextMutedIds);
      safeSetLocalStorage('dcm_muted_server_ids', JSON.stringify(nextMutedIds));
    }
  }, [servers, mutedServerIds]);

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
      const currentOfflineIds = loadedServers.filter((s: MonitoredServer) => s && s.status === 'DOWN').map((s: MonitoredServer) => s.id);
      
      if (isFirstLoadRef.current) {
        prevOfflineServersRef.current = currentOfflineIds;
        isFirstLoadRef.current = false;
      } else {
        const hasNewOffline = currentOfflineIds.some((id: any) => !prevOfflineServersRef.current.includes(id));
        if (hasNewOffline) {
          // Unmute when another server drops ping
          setIsMuted(false);
          safeSetLocalStorage('dcm_alert_muted', 'false');
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

  // Fetch custom alarm sound only once on mount
  useEffect(() => {
    if (canView) {
      fetchCustomAlarm();
    }
  }, [canView]);

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

  // Auto refresh data every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (canView) {
      interval = setInterval(() => {
        if (document.hidden) return;
        loadDashboardMetrics();
        loadServers();
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [canView, search, sortBy, order]);

  // Automatically reload the page every 1 hour (3600000 ms) while on this page
  useEffect(() => {
    const reloadTimer = setInterval(() => {
      window.location.reload();
    }, 3600000);

    return () => clearInterval(reloadTimer);
  }, []);

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
    safeSetLocalStorage('dcm_alert_muted', String(newMuteState));

    if (newMuteState) {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      safeStopAudio(audioInstanceRef.current);
    }
  };

  // Handle Audio File upload (converts to base64 Data URL and saves to backend)
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert("Please upload a valid audio file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await request.post('/api/server-ping-monitoring/alarm-sound', {
          dataUrl,
          filename: file.name
        });
        await fetchCustomAlarm();
        alert(`Successfully uploaded custom alarm sound: ${file.name}`);
      } catch (err: any) {
        alert(err.response?.data?.detail || "Failed to upload custom alarm sound. File may be too large.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Clear uploaded audio
  const handleClearAudio = async () => {
    try {
      await request.delete('/api/server-ping-monitoring/alarm-sound');
      if (activeAlarmUrlRef.current && activeAlarmUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeAlarmUrlRef.current);
      }
      updateAlarmUrl(null);
      setAudioFileName('');
      alert("Alert sound reset to default synthesizer beep.");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to clear alarm sound.");
    }
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
    if (isFormInvalid) return;
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

  // Perform server acknowledgment/unacknowledgement after confirmation
  const handleConfirmAcknowledge = async () => {
    if (!ackTargetServer) return;
    try {
      const nextState = !ackTargetServer.isAcknowledged;
      
      // Optimistically stop the alarm if this server is being acknowledged and no other offline servers remain
      if (nextState) {
        const hasOtherUnacknowledgedOffline = servers.some(s => {
          if (!s) return false;
          if (!s.isEnabled) return false;
          if (s.id === ackTargetServer.id) return false;
          if (mutedServerIds.includes(s.id)) return false;
          if (s.isAcknowledged) return false;
          return s.status === 'DOWN' || 
            ((s.monitoringType === 'both' || s.monitoringType === 'port') && hasOfflinePorts(s));
        });

        if (!hasOtherUnacknowledgedOffline) {
          if (audioIntervalRef.current) {
            clearInterval(audioIntervalRef.current);
            audioIntervalRef.current = null;
          }
          safeStopAudio(audioInstanceRef.current);
        }
      }

      await acknowledgeServer(ackTargetServer.id, nextState);
      setAckTargetServer(null);
      await loadServers();
      await loadDashboardMetrics();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update server acknowledgment status");
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
          {isSuperuser && (
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
          )}

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
              {servers.filter(Boolean).map((srv) => (
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <span className={`${styles.container__statusChip} ${styles[srv.status]}`} style={{ padding: '2px 8px', fontSize: '0.7rem', width: 'fit-content' }}>
                          {srv.status === 'UP' && <CheckIcon size={12} />}
                          {srv.status === 'DOWN' && <ErrorIcon size={12} />}
                          {srv.status}
                        </span>
                        {srv.isAcknowledged && (
                          <Chip 
                            size="small" 
                            label="Acknowledged" 
                            color="warning" 
                            sx={{ fontWeight: 600, fontSize: '0.65rem', height: '18px', mt: 0.25 }} 
                          />
                        )}
                        {srv.monitoringType === 'both' && getPortsStatusEntries(srv.portsStatus).length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                            {getPortsStatusEntries(srv.portsStatus).map(([port, status]) => (
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

                      {/* Individual Mute/Alarm toggle */}
                      {(srv.status === 'DOWN' || 
                        ((srv.monitoringType === 'both' || srv.monitoringType === 'port') && 
                         hasOfflinePorts(srv))) && (
                        <Tooltip title={mutedServerIds.includes(srv.id) ? "Unmute this server alert" : "Mute this server alert"}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleToggleMuteServer(srv.id)}
                            sx={{
                              p: 0.5,
                              color: mutedServerIds.includes(srv.id) ? '#64748b' : '#ef4444',
                              border: '1px solid',
                              borderColor: mutedServerIds.includes(srv.id) ? '#cbd5e1' : '#fecaca',
                              background: mutedServerIds.includes(srv.id) ? '#f8fafc' : '#fef2f2',
                            }}
                          >
                            {mutedServerIds.includes(srv.id) ? <VolumeOffIcon size={14} /> : <VolumeUpIcon size={14} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    {srv.status === 'DOWN' ? '--' : `${srv.responseTimeMs} ms`}
                  </TableCell>

                  <TableCell sx={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500, py: 0.75 }}>
                    {safeFormatDateTime(srv.lastFailedTime)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: '#64748b', py: 0.75 }}>
                    {safeFormatTime(srv.lastUpdated)}
                  </TableCell>
                  {canUpdate || canDelete ? (
                    <TableCell align="center" sx={{ py: 0.75 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {canUpdate && (
                          <IconButton size="small" onClick={() => handleOpenServerModal(srv)} sx={{ color: '#3b82f6', p: 0.5 }}>
                            <EditIcon size={16} />
                          </IconButton>
                        )}
                        {canUpdate && (srv.status === 'DOWN' || 
                          ((srv.monitoringType === 'both' || srv.monitoringType === 'port') && 
                           hasOfflinePorts(srv))) && (
                          <Tooltip title={srv.isAcknowledged ? "Unacknowledge Server" : "Acknowledge Server"}>
                            <IconButton 
                              size="small" 
                              onClick={() => setAckTargetServer(srv)} 
                              sx={{ color: srv.isAcknowledged ? '#f59e0b' : '#64748b', p: 0.5 }}
                            >
                              {srv.isAcknowledged ? <NotificationsOffIcon size={16} /> : <NotificationsActiveIcon size={16} />}
                            </IconButton>
                          </Tooltip>
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
            InputLabelProps={{ shrink: true }}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { height: '30px', fontSize: '0.8rem' } }}
          />
          <MuiTextField
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
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
              {dropLogs.filter(Boolean).map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>{log.name}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{log.ipAddress}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{log.adminName || '--'}</TableCell>
                  <TableCell sx={{ color: '#ef4444', fontWeight: 500, py: 0.75, fontSize: '0.75rem' }}>
                    {safeFormatDateTime(log.timestamp)}
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
            error={!!nameErr}
            helperText={nameErr}
          />
          <TextField
            label="IP Address or FQDN"
            value={serverForm.ipAddress}
            onChange={(e) => setServerForm({ ...serverForm, ipAddress: e.target.value })}
            required
            fullWidth
            error={!!ipAddressErr}
            helperText={ipAddressErr}
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
              error={!!portsInputErr}
              helperText={portsInputErr}
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
                error={!!intervalErr}
                helperText={intervalErr}
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
                error={!!timeoutErr}
                helperText={timeoutErr}
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
                error={!!retryCountErr}
                helperText={retryCountErr}
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
            <Button size="small" type="submit" variant="contained" disabled={isFormInvalid} sx={{ background: '#3b82f6', '&:hover': { background: '#2563eb' } }}>
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

      {/* Acknowledge Confirmation Modal */}
      <Modal
        open={Boolean(ackTargetServer)}
        handleClose={() => setAckTargetServer(null)}
        title={ackTargetServer?.isAcknowledged ? "Confirm Unacknowledgement" : "Confirm Acknowledgement"}
      >
        <Box sx={{ p: 0.5 }}>
          <Typography sx={{ mb: 2, fontSize: '0.9rem', color: '#1e293b' }}>
            {ackTargetServer?.isAcknowledged ? (
              <>Are you sure you want to unacknowledge server <strong>{ackTargetServer?.name}</strong>? Alerts and notifications will be re-enabled.</>
            ) : (
              <>Are you sure you want to acknowledge server <strong>{ackTargetServer?.name}</strong>? This will silence all notifications and alarms for it until it comes back online.</>
            )}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setAckTargetServer(null)}>
              Cancel
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              onClick={handleConfirmAcknowledge}
              sx={{ background: '#f59e0b', '&:hover': { background: '#d97706' } }}
            >
              {ackTargetServer?.isAcknowledged ? "Unacknowledge" : "Acknowledge"}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default ServerPingMonitoring;
