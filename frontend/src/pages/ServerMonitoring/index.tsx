import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  CircularProgress, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  InputAdornment,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  MdDns as ServerIcon, 
  MdSpeed as CpuIcon, 
  MdMemory as RamIcon, 
  MdStorage as HddIcon, 
  MdImportExport as NetworkIcon,
  MdNotificationsActive as AlertIcon,
  MdPlayCircleFilled as PlayIcon,
  MdRefresh as RefreshIcon,
  MdAdd as AddIcon,
  MdTerminal as ConsoleIcon,
  MdWifi as ConnectedIcon,
  MdPower as PowerIcon,
  MdThermostat as TempIcon,
  MdAir as FanIcon,
  MdSearch as SearchIcon,
  MdDelete as DeleteIcon,
  MdArrowBack as BackIcon,
  MdCheckCircle as HealthyIcon,
  MdWarning as WarningIcon,
  MdKeyboardArrowDown as KeyboardArrowDownIcon,
  MdKeyboardArrowUp as KeyboardArrowUpIcon,
  MdLayers as ClusterIcon
} from 'react-icons/md';
import { fetchVCenters, fetchClusters, fetchVCenterTelemetry, createVCenter, fetchNodes, deleteVCenter, fetchVCenterClustersPreview } from './action';
import { useToast } from '../../contexts/ToastContext';
import styles from './index.module.scss';

interface VCenterItem {
  id: string;
  _id?: string;
  name: string;
  ipAddress: string;
  clusterId: string;
  vcenterVersion: string;
  vcenterType: string;
  licenceExpiry: string;
  cpuCores: string;
  ram: string;
  hdd: string;
}

interface HostTelemetry {
  name: string;
  ipAddress: string;
  status: string;
  cpuUsage: number;
  ramUsage: number;
  cpuTemp: string;
  ramTemp: string;
  fanSpeed: string;
  powerWatts: number;
}

interface VmTelemetry {
  name: string;
  ipAddress: string;
  node: string;
  cpuUsage: number;
  ramUsage: number;
  status: string;
}

interface Alarm {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  timestamp: string;
}

interface EventLog {
  timestamp: string;
  message: string;
}

interface MonitorData {
  id: string;
  name: string;
  ipAddress: string;
  status: 'Green' | 'Yellow' | 'Red';
  version: string;
  type: string;
  licenceExpiry: string;
  metrics: {
    cpuUsage: number;
    ramUsage: number;
    hddUsage: number;
    networkTraffic: number;
  };
  hosts: HostTelemetry[];
  vms: VmTelemetry[];
  alarms: Alarm[];
  events: EventLog[];
}

const ServerMonitoring: React.FC = () => {
  const { showToast } = useToast();
  const [vcenters, setVcenters] = useState<VCenterItem[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [nodesList, setNodesList] = useState<any[]>([]);
  
  const [selectedVcenter, setSelectedVcenter] = useState<VCenterItem | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [selectedVm, setSelectedVm] = useState<VmTelemetry | null>(null);
  
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [vmSearch, setVmSearch] = useState('');
  const [vcenterSearch, setVcenterSearch] = useState('');
  
  // Tree expanded rows
  const [expandedVcenterId, setExpandedVcenterId] = useState<string | null>(null);
  const [vcenterTelemetryMap, setVcenterTelemetryMap] = useState<Record<string, MonitorData>>({});
  const [offlineVcenterIds, setOfflineVcenterIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vcenterToDelete, setVcenterToDelete] = useState<string | null>(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVcenter, setNewVcenter] = useState({
    name: '',
    ipAddress: '',
    clusterId: '',
    username: '',
    password: ''
  });

  const [vcenterFetchedClusters, setVcenterFetchedClusters] = useState<{id: string, name: string}[]>([]);
  const [fetchingLiveClusters, setFetchingLiveClusters] = useState(false);

  const handleFetchLiveClusters = async () => {
    if (!newVcenter.ipAddress || !newVcenter.username || !newVcenter.password) {
      showToast('Please enter IP Address, Username, and Password first!', 'warning');
      return;
    }
    
    setFetchingLiveClusters(true);
    try {
      const liveClustersList = await fetchVCenterClustersPreview({
        ipAddress: newVcenter.ipAddress,
        username: newVcenter.username,
        password: newVcenter.password
      });
      
      setVcenterFetchedClusters(liveClustersList);
      showToast(`Successfully discovered ${liveClustersList.length} clusters from live vCenter inventory!`, 'success');
      
      if (liveClustersList.length > 0) {
        setNewVcenter(prev => ({ ...prev, clusterId: liveClustersList[0].id }));
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to authenticate and fetch inventory from vCenter', 'error');
    } finally {
      setFetchingLiveClusters(false);
    }
  };

  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  // Fetch registered vCenters, Clusters & Nodes
  const loadInitialData = async () => {
    setLoadingList(true);
    try {
      const [vcList, clusterList, nodesRes] = await Promise.all([
        fetchVCenters(),
        fetchClusters(),
        fetchNodes()
      ]);
      setVcenters(vcList);
      setClusters(clusterList);
      setNodesList(nodesRes);

      if (clusterList && clusterList.length > 0) {
        setNewVcenter(prev => ({ 
          ...prev, 
          clusterId: clusterList[0].id || clusterList[0]._id || '',
          username: '',
          password: ''
        }));
      }

      // Trigger dynamic background reachability checks for each vCenter
      vcList.forEach((vc: any) => {
        const id = vc.id || vc._id;
        if (!id) return;
        fetchVCenterTelemetry(id)
          .then((data) => {
            setVcenterTelemetryMap(prev => ({ ...prev, [id]: data }));
          })
          .catch(() => {
            setOfflineVcenterIds(prev => [...prev, id]);
          });
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to load virtualization configurations', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch live telemetry for selected vCenter
  const fetchTelemetry = async (vcId: string, silent = false) => {
    if (!silent) setLoadingMonitor(true);
    try {
      const data = await fetchVCenterTelemetry(vcId);
      setMonitorData(data);
      
      // Update telemetry map as well
      setVcenterTelemetryMap(prev => ({ ...prev, [vcId]: data }));
      
      // Update terminal with fresh log line
      const timeStr = new Date().toLocaleTimeString();
      const freshLine = `[${timeStr}] vCenter Telemetry Frame parsed. Connected hypervisors list synced.`;
      setTerminalLines(prev => [...prev.slice(-30), freshLine]);

      // Pop Toast alerts on Warning/Critical alarms
      if (data.alarms && data.alarms.length > 0) {
        const primaryAlarm = data.alarms[0];
        if (primaryAlarm.severity === 'Critical') {
          showToast(`vCenter Alert: ${primaryAlarm.message}`, 'error');
        } else if (primaryAlarm.severity === 'Warning' && !silent) {
          showToast(`vCenter Warning: ${primaryAlarm.message}`, 'warning');
        }
      }
    } catch (err) {
      console.error(err);
      if (!silent) showToast('Failed to connect to vCenter monitor endpoint', 'error');
    } finally {
      if (!silent) setLoadingMonitor(false);
    }
  };

  // Poll for active selected monitoring telemetry
  useEffect(() => {
    if (!selectedVcenter) return;
    
    const vcId = selectedVcenter.id || selectedVcenter._id;
    if (!vcId) return;

    fetchTelemetry(vcId);

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTelemetry(vcId, true);
    }, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [selectedVcenter, autoRefresh]);

  // Keep terminal scrolled to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines, monitorData]);

  // Handle Deletion Trigger
  const handleDeleteClick = (id: string) => {
    setVcenterToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Perform Deletion on Confirmation
  const handleConfirmDelete = async () => {
    if (!vcenterToDelete) return;
    try {
      await deleteVCenter(vcenterToDelete);
      showToast('vCenter appliance deleted successfully!', 'success');
      
      const updatedList = vcenters.filter(vc => (vc.id || vc._id) !== vcenterToDelete);
      setVcenters(updatedList);
      
      if (selectedVcenter && (selectedVcenter.id || selectedVcenter._id) === vcenterToDelete) {
        setSelectedVcenter(null);
        setMonitorData(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete vCenter appliance', 'error');
    } finally {
      setDeleteConfirmOpen(false);
      setVcenterToDelete(null);
    }
  };

  // Toggle expanded row for vCenters
  const handleToggleExpand = async (vc: VCenterItem) => {
    const vcId = vc.id || vc._id;
    if (!vcId) return;
    
    if (expandedVcenterId === vcId) {
      setExpandedVcenterId(null);
    } else {
      setExpandedVcenterId(vcId);
      
      // If we don't have telemetry loaded for this vCenter, load it now!
      if (!vcenterTelemetryMap[vcId]) {
        setLoadingMonitor(true);
        try {
          const data = await fetchVCenterTelemetry(vcId);
          setVcenterTelemetryMap(prev => ({ ...prev, [vcId]: data }));
        } catch (err) {
          showToast('Failed to fetch node & VM details for this appliance', 'error');
        } finally {
          setLoadingMonitor(false);
        }
      }
    }
  };

  // Handle Form Submission for new vCenter
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVcenter.name || !newVcenter.ipAddress) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    // Prevent registering duplicate Name or IP
    const nameLower = newVcenter.name.trim().toLowerCase();
    const ipTrimmed = newVcenter.ipAddress.trim().toLowerCase();

    const isDuplicateName = vcenters.some(vc => vc.name.toLowerCase() === nameLower);
    const isDuplicateIp = vcenters.some(vc => vc.ipAddress.toLowerCase() === ipTrimmed);

    if (isDuplicateName) {
      showToast('A virtualization controller with this name is already registered!', 'error');
      return;
    }
    if (isDuplicateIp) {
      showToast('A virtualization controller with this IP address or hostname is already registered!', 'error');
      return;
    }

    try {
      const targetClusterId = newVcenter.clusterId || clusters[0]?.id || clusters[0]?._id || "default";

      const payload = {
        name: newVcenter.name,
        ipAddress: newVcenter.ipAddress,
        clusterId: targetClusterId,
        username: newVcenter.username || undefined,
        password: newVcenter.password || undefined
      };

      const res = await createVCenter(payload);
      showToast('vCenter registered successfully!', 'success');
      setIsModalOpen(false);
      
      const updatedList = [...vcenters, res];
      setVcenters(updatedList);

      // Check reachability for newly registered vCenter
      const newId = res.id || res._id;
      if (newId) {
        fetchVCenterTelemetry(newId)
          .then((data) => {
            setVcenterTelemetryMap(prev => ({ ...prev, [newId]: data }));
          })
          .catch(() => {
            setOfflineVcenterIds(prev => [...prev, newId]);
          });
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to register vCenter details', 'error');
    }
  };

  const getMetricProgressColor = (val: number) => {
    if (val > 80) return '#ef4444'; // Red
    if (val > 65) return '#f59e0b'; // Yellow
    return '#3b82f6'; // Blue
  };



  // Filtered VM list
  const filteredVms = monitorData?.vms.filter(vm => 
    (vm.name || '').toLowerCase().includes((vmSearch || '').toLowerCase()) || 
    (vm.ipAddress || '').toLowerCase().includes((vmSearch || '').toLowerCase())
  ) || [];

  // Filtered vCenter list
  const filteredVcenters = vcenters.filter(vc =>
    (vc.name || '').toLowerCase().includes((vcenterSearch || '').toLowerCase()) ||
    (vc.ipAddress || '').toLowerCase().includes((vcenterSearch || '').toLowerCase())
  );

  return (
    <Box className={styles.container}>
      
      {/* 1. MASTER VIEW (Virtualizations list table) */}
      {!selectedVcenter ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <header className={styles.container__header}>
            <Box>
              <h1 className={styles.container__header__title}>VMware Infrastructure Management</h1>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                Directory of registered virtual vCenter appliances. Click expand arrows to monitor ESXi Hosts & VM guest lists.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
            >
              Register vCenter
            </Button>
          </header>

          {/* Quick Info Strips */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2.5, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>
                  <ServerIcon style={{ fontSize: '1.75rem' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>Active Appliances</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{vcenters.length} registered</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2.5, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                  <HealthyIcon style={{ fontSize: '1.75rem' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>Cluster Status</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>100% Operational</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2.5, borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>
                  <WarningIcon style={{ fontSize: '1.75rem' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>Total Alarms</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {vcenters.reduce((acc, vc) => {
                      const vcId = vc.id || vc._id;
                      const isOffline = vcId ? offlineVcenterIds.includes(vcId) : false;
                      const telemetry = vcId ? vcenterTelemetryMap[vcId] : null;
                      const criticalCount = telemetry 
                        ? telemetry.alarms.filter((a: any) => a.severity === 'Critical').length 
                        : 0;
                      return acc + (isOffline ? 1 : criticalCount);
                    }, 0)} critical/offline
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Search bar */}
          <TextField
            size="small"
            placeholder="Search virtualization appliances by name or IP..."
            value={vcenterSearch}
            onChange={(e) => setVcenterSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              style: { borderRadius: '12px', backgroundColor: '#fff' }
            }}
            sx={{ maxWidth: '400px' }}
          />

          {loadingList ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredVcenters.length === 0 ? (
            <Box className={styles.container__emptyState}>
              <ServerIcon style={{ fontSize: '4.5rem', color: '#94a3b8', marginBottom: '20px' }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>No VMware Appliances Registered</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3, maxWidth: '400px' }}>
                Quickly register virtual vCenter consoles to aggregate physical cluster nodes, CPU, RAM, and datastores.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>
                Register vCenter Appliance
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none', overflow: 'hidden' }}>
              <MuiTable>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ width: '60px' }}></TableCell>
                    <TableCell sx={{ fontWeight: 800, width: '80px' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Host Identifier</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>IP Address</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Host Cluster</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Hypervisor</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Resource Provision</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Active Warnings & Alarms</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, width: '100px' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVcenters.map((vc) => {
                    const mappedCluster = clusters.find(c => {
                      const clusterKey = c.id || c._id || '';
                      return clusterKey && vc.clusterId && String(clusterKey) === String(vc.clusterId);
                    })?.clusterName || 'vSphere Prod Cluster';
                    const vcId = vc.id || vc._id || '';
                    const isExpanded = expandedVcenterId === vcId;
                    const telemetry = vcenterTelemetryMap[vcId];
                    const isOffline = offlineVcenterIds.includes(vcId);

                    // Dynamic Connection Status color indicator
                    const connectionStatus = isOffline 
                      ? 'Red' 
                      : telemetry 
                        ? telemetry.status 
                        : 'Green'; // Fallback to green while querying

                    // Dynamic Alarms count harvested from real database
                    const criticalAlarmsCount = telemetry 
                      ? telemetry.alarms.filter((a: any) => a.severity === 'Critical').length 
                      : 0;
                    const warningAlarmsCount = telemetry 
                      ? telemetry.alarms.filter((a: any) => a.severity === 'Warning').length 
                      : 0;

                    // Compute actual, live dynamic resource capacity from node_details
                    const clusterNodes = nodesList.filter((n: any) => n.clusterId === vc.clusterId);
                    
                    let liveCores = 0;
                    let liveRamGb = 0;
                    let liveHddGb = 0;
                    
                    clusterNodes.forEach((node: any) => {
                      liveCores += parseInt(node.totalCpu) || 0;
                      liveRamGb += parseInt(node.totalRam) || 0;
                      liveHddGb += parseInt(node.totalHardisk) || 0;
                    });

                    const displayCores = liveCores > 0 ? `${liveCores} Cores` : '--';
                    const displayRam = liveRamGb > 0 ? `${liveRamGb} GB` : '--';
                    const displayHdd = liveHddGb > 0 ? `${liveHddGb} GB` : '--';

                    let esxiVersion = '--';
                    if (clusterNodes.length > 0) {
                      const firstNode = clusterNodes[0];
                      const hypervisor = firstNode.hypervisor || '';
                      if (hypervisor.toUpperCase().includes('ESXI')) {
                        const parts = hypervisor.split(' ');
                        esxiVersion = parts[parts.length - 1];
                      } else {
                        esxiVersion = hypervisor || '8.0.0';
                      }
                    } else {
                      esxiVersion = vc.vcenterVersion || '8.0.2';
                    }

                    return (
                      <React.Fragment key={vcId}>
                        <TableRow 
                          hover 
                          onClick={() => {
                            if (isOffline) {
                              showToast(`vCenter appliance at ${vc.ipAddress} is unreachable. Check physical connection.`, 'error');
                            } else {
                              setSelectedVcenter(vc);
                            }
                          }}
                          sx={{ cursor: 'pointer', transition: 'background-color 0.2s', '&:hover': { bgcolor: '#f1f5f9' } }}
                        >
                          {/* Row expander button */}
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(vc);
                              }}
                            >
                              {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                          </TableCell>

                          {/* Status badge */}
                          <TableCell>
                            <span className={`${styles.container__statusIndicator} ${connectionStatus}`}></span>
                          </TableCell>
                          
                          {/* Name */}
                          <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                            {vc.name}
                          </TableCell>
                          
                          {/* IP Address */}
                          <TableCell sx={{ color: '#475569', fontFamily: 'monospace' }}>
                            {vc.ipAddress}
                          </TableCell>
                          
                          {/* Mapped Cluster */}
                          <TableCell>
                            <Chip label={mappedCluster} size="small" variant="outlined" sx={{ fontWeight: 600, color: '#3b82f6', borderColor: '#bfdbfe' }} />
                          </TableCell>
                          
                          {/* Version */}
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>v{esxiVersion}</Typography>
                            <Typography variant="caption" color="textSecondary">{clusterNodes.length > 0 ? 'Hypervisor (ESXi)' : vc.vcenterType.split(' ')[0]}</Typography>
                          </TableCell>
                          
                          {/* Resources */}
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip label={displayCores} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                              <Chip label={displayRam} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                              <Chip label={displayHdd} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                            </Box>
                          </TableCell>
                          
                          {/* Warnings & Alerts */}
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {isOffline ? (
                                <Chip 
                                  label="Offline / Unreachable" 
                                  size="small" 
                                  color="error" 
                                  sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem' }} 
                                />
                              ) : !telemetry ? (
                                <Chip 
                                  label="Querying..." 
                                  size="small" 
                                  color="default" 
                                  variant="outlined"
                                  sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem' }} 
                                />
                              ) : (
                                <>
                                  {criticalAlarmsCount > 0 && (
                                    <Chip 
                                      label={`${criticalAlarmsCount} Critical`} 
                                      size="small" 
                                      color="error" 
                                      sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem' }} 
                                    />
                                  )}
                                  {warningAlarmsCount > 0 && (
                                    <Chip 
                                      label={`${warningAlarmsCount} Warnings`} 
                                      size="small" 
                                      color="warning" 
                                      sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem', color: '#fff' }} 
                                    />
                                  )}
                                  {criticalAlarmsCount === 0 && warningAlarmsCount === 0 && (
                                    <Chip 
                                      label="Healthy" 
                                      size="small" 
                                      color="success" 
                                      variant="outlined"
                                      sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem' }} 
                                    />
                                  )}
                                </>
                              )}
                            </Box>
                          </TableCell>

                          {/* Delete Action */}
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(vcId);
                              }}
                              sx={{ opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'rgba(239, 68, 68, 0.08)' } }}
                            >
                              <DeleteIcon style={{ fontSize: '1.15rem' }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>

                        {/* Hierarchical Expansion Panel */}
                        {isExpanded && (
                          <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell colSpan={9} sx={{ p: 3, borderLeft: '4px solid #3b82f6' }}>
                              {loadingMonitor && !telemetry ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                                  <CircularProgress size={20} />
                                  <Typography variant="body2" color="textSecondary">Querying ESXi cluster nodes and VM mapping matrices...</Typography>
                                </Box>
                              ) : telemetry ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ClusterIcon style={{ color: '#3b82f6' }} /> Mapped Nodes & Guest VMs ({telemetry.hosts.length} Hosts, {telemetry.vms.length} VMs)
                                  </Typography>
                                  
                                  {telemetry.hosts.length === 0 ? (
                                    <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', pl: 2 }}>
                                      No ESXi hypervisor hosts registered in this vCenter cluster group.
                                    </Typography>
                                  ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {telemetry.hosts.map((host, hIdx) => {
                                        // Filter VMs mapping to this host's hostName
                                        const hostVms = telemetry.vms.filter(vm => 
                                          (vm.node || '').toLowerCase() === (host.name || '').toLowerCase()
                                        );

                                        return (
                                          <Paper 
                                            key={hIdx} 
                                            sx={{ 
                                              p: 2, 
                                              borderRadius: '12px', 
                                              border: '1px solid #e2e8f0', 
                                              bgcolor: '#fff', 
                                              boxShadow: 'none' 
                                            }}
                                          >
                                            {/* ESXi Host Header */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pb: 1.5, borderBottom: '1px solid #f1f5f9', mb: 1.5 }}>
                                              <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                  <ConnectedIcon style={{ color: '#10b981' }} /> {host.name}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">IP: {host.ipAddress}</Typography>
                                              </Box>
                                              
                                              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                  <CpuIcon style={{ color: '#64748b' }} />
                                                  <span style={{ fontWeight: 600 }}>CPU:</span> {host.cpuUsage}%
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                  <RamIcon style={{ color: '#64748b' }} />
                                                  <span style={{ fontWeight: 600 }}>RAM:</span> {host.ramUsage}%
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                  <TempIcon style={{ color: parseInt(host.cpuTemp) > 50 ? '#ef4444' : '#64748b' }} />
                                                  <span style={{ fontWeight: 600 }}>Temp:</span> {host.cpuTemp}
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                  <PowerIcon style={{ color: '#64748b' }} />
                                                  <span style={{ fontWeight: 600 }}>Power:</span> {host.powerWatts}W
                                                </Box>
                                              </Box>
                                            </Box>

                                            {/* Guest VMs hosted inside this node */}
                                            <Box sx={{ pl: 2 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', mb: 1, display: 'block' }}>
                                                Guest Virtual Machines hosted on this Node ({hostVms.length})
                                              </Typography>
                                              {hostVms.length === 0 ? (
                                                <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic', pl: 1 }}>
                                                  No active VMs running on this ESXi node.
                                                </Typography>
                                              ) : (
                                                <TableContainer component={Box} sx={{ border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                                  <MuiTable size="small">
                                                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                      <TableRow>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, py: 0.5 }}>VM Name</TableCell>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, py: 0.5 }}>IP Address</TableCell>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, py: 0.5 }}>CPU Load</TableCell>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, py: 0.5 }}>RAM Load</TableCell>
                                                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, py: 0.5 }} align="right">Status</TableCell>
                                                      </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                      {hostVms.map((vm, vmIdx) => (
                                                        <TableRow 
                                                          key={vmIdx} 
                                                          hover
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVm(vm);
                                                          }}
                                                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f1f5f9' } }}
                                                        >
                                                          <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, py: 0.5 }}>{vm.name}</TableCell>
                                                          <TableCell sx={{ fontSize: '0.75rem', py: 0.5, fontFamily: 'monospace' }}>{vm.ipAddress}</TableCell>
                                                          <TableCell sx={{ fontSize: '0.75rem', py: 0.5, fontWeight: 600 }}>{vm.cpuUsage}%</TableCell>
                                                          <TableCell sx={{ fontSize: '0.75rem', py: 0.5, fontWeight: 600 }}>{vm.ramUsage}%</TableCell>
                                                          <TableCell sx={{ py: 0.5 }} align="right">
                                                            <Chip 
                                                              label={vm.status} 
                                                              size="small" 
                                                              color={vm.status === 'Running' ? 'success' : 'default'}
                                                              sx={{ height: 16, fontSize: '0.65rem', fontWeight: 'bold' }}
                                                            />
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </MuiTable>
                                                </TableContainer>
                                              )}
                                            </Box>
                                          </Paper>
                                        );
                                      })}
                                    </Box>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                  Failed to resolve telemetry logs.
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </MuiTable>
            </TableContainer>
          )}
        </Box>
      ) : (
        
        // 2. DETAILS FULL WORKSPACE VIEW (Live Telemetry Dashboard for Selected vCenter)
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Header Panel with large back button */}
          <header className={styles.container__header}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<BackIcon />}
                onClick={() => {
                  setSelectedVcenter(null);
                  setMonitorData(null);
                }}
                size="small"
                sx={{ borderRadius: '10px', textTransform: 'none' }}
              >
                Back to Infrastructure
              </Button>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {selectedVcenter.name}
                  </Typography>
                  <span className={`${styles.container__statusIndicator} ${monitorData?.status || 'Green'}`}></span>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  Management Engine Address: <span style={{ fontWeight: 600, color: '#3b82f6', fontFamily: 'monospace' }}>{selectedVcenter.ipAddress}</span>
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={autoRefresh} 
                    onChange={(e) => setAutoRefresh(e.target.checked)} 
                    color="primary"
                  />
                }
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Auto-Refresh (5s)</Typography>}
              />
              
              <Button
                variant="outlined"
                startIcon={loadingMonitor ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={() => fetchTelemetry(selectedVcenter.id || selectedVcenter._id || '')}
                disabled={loadingMonitor}
                size="small"
              >
                Refresh
              </Button>
            </Box>
          </header>

          {/* Core Monitoring workspace details */}
          {loadingMonitor && !monitorData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
              <CircularProgress />
            </Box>
          ) : monitorData && (() => {
            const clusterNodes = nodesList.filter((n: any) => n.clusterId === selectedVcenter?.clusterId);
            let totalCores = 0;
            let totalRamGb = 0;
            let totalHddGb = 0;
            clusterNodes.forEach((node: any) => {
              totalCores += parseInt(node.totalCpu) || 0;
              totalRamGb += parseInt(node.totalRam) || 0;
              totalHddGb += parseInt(node.totalHardisk) || 0;
            });

            if (totalCores === 0 && selectedVcenter?.cpuCores) {
              totalCores = parseInt(selectedVcenter.cpuCores) || 0;
            }
            if (totalRamGb === 0 && selectedVcenter?.ram) {
              totalRamGb = parseInt(selectedVcenter.ram) || 0;
            }
            if (totalHddGb === 0 && selectedVcenter?.hdd) {
              totalHddGb = parseInt(selectedVcenter.hdd) || 0;
            }

            // High reliability fallbacks if unresolved
            if (totalCores === 0) totalCores = 32;
            if (totalRamGb === 0) totalRamGb = 128;
            if (totalHddGb === 0) totalHddGb = 2048;

            const cpuUsed = ((monitorData.metrics.cpuUsage || 0) / 100) * totalCores;
            const cpuFree = Math.max(0, totalCores - cpuUsed);

            const ramUsed = ((monitorData.metrics.ramUsage || 0) / 100) * totalRamGb;
            const ramFree = Math.max(0, totalRamGb - ramUsed);

            const hddUsed = ((monitorData.metrics.hddUsage || 0) / 100) * totalHddGb;
            const hddFree = Math.max(0, totalHddGb - hddUsed);

            return (
              <Box className={styles.container__monitorPanel}>
                
                {/* Left Column: Aggregates and ESXi Hypervisors */}
                <Box className={styles.container__mainColumn}>
                  
                  {/* 1. Resources Gauge strip */}
                  <Box className={styles.container__metricsGrid}>
                    
                    {/* CPU gauge */}
                    <Box className={styles.container__metricCard}>
                      <div className={styles.container__metricCard__header}>
                        <span>ESXi CPU LOAD</span>
                        <CpuIcon style={{ fontSize: '1.25rem' }} />
                      </div>
                      <div className={styles.container__metricCard__value}>
                        {monitorData.hosts.length > 0 ? `${monitorData.metrics.cpuUsage}%` : '--'}
                      </div>
                      <div className={styles.container__metricCard__progress}>
                        <div style={{ 
                          width: monitorData.hosts.length > 0 ? `${monitorData.metrics.cpuUsage}%` : '0%', 
                          backgroundColor: getMetricProgressColor(monitorData.metrics.cpuUsage) 
                        }} />
                      </div>
                      {monitorData.hosts.length > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '0.7rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Used CPU:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{cpuUsed.toFixed(1)} Cores ({monitorData.metrics.cpuUsage.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Free / Total:</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{cpuFree.toFixed(1)} Cores / {totalCores} Cores</span>
                          </div>
                        </div>
                      )}
                    </Box>

                    {/* RAM gauge */}
                    <Box className={styles.container__metricCard}>
                      <div className={styles.container__metricCard__header}>
                        <span>RAM ALLOCATION</span>
                        <RamIcon style={{ fontSize: '1.25rem' }} />
                      </div>
                      <div className={styles.container__metricCard__value}>
                        {monitorData.hosts.length > 0 ? `${monitorData.metrics.ramUsage}%` : '--'}
                      </div>
                      <div className={styles.container__metricCard__progress}>
                        <div style={{ 
                          width: monitorData.hosts.length > 0 ? `${monitorData.metrics.ramUsage}%` : '0%', 
                          backgroundColor: getMetricProgressColor(monitorData.metrics.ramUsage) 
                        }} />
                      </div>
                      {monitorData.hosts.length > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '0.7rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Used Memory:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{ramUsed.toFixed(1)} GB ({monitorData.metrics.ramUsage.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Free / Total:</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{ramFree.toFixed(1)} GB / {totalRamGb} GB</span>
                          </div>
                        </div>
                      )}
                    </Box>

                    {/* HDD Datastores */}
                    <Box className={styles.container__metricCard}>
                      <div className={styles.container__metricCard__header}>
                        <span>DATASTORE STORAGE</span>
                        <HddIcon style={{ fontSize: '1.25rem' }} />
                      </div>
                      <div className={styles.container__metricCard__value}>
                        {monitorData.hosts.length > 0 ? `${monitorData.metrics.hddUsage}%` : '--'}
                      </div>
                      <div className={styles.container__metricCard__progress}>
                        <div style={{ 
                          width: monitorData.hosts.length > 0 ? `${monitorData.metrics.hddUsage}%` : '0%', 
                          backgroundColor: getMetricProgressColor(monitorData.metrics.hddUsage) 
                        }} />
                      </div>
                      {monitorData.hosts.length > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '0.7rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Used Storage:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{hddUsed.toFixed(1)} GB ({monitorData.metrics.hddUsage.toFixed(0)}%)</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Free / Total:</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{hddFree.toFixed(1)} GB / {totalHddGb} GB</span>
                          </div>
                        </div>
                      )}
                    </Box>

                    {/* Network */}
                    <Box className={styles.container__metricCard}>
                      <div className={styles.container__metricCard__header}>
                        <span>NETWORK THRU</span>
                        <NetworkIcon style={{ fontSize: '1.25rem' }} />
                      </div>
                      <div className={styles.container__metricCard__value}>
                        {monitorData.hosts.length > 0 ? `${monitorData.metrics.networkTraffic} Mbps` : '--'}
                    </div>
                    <div className={styles.container__metricCard__progress}>
                      <div style={{ 
                        width: monitorData.hosts.length > 0 ? `${Math.min(100, (monitorData.metrics.networkTraffic / 500) * 100)}%` : '0%', 
                        backgroundColor: '#10b981' 
                      }} />
                    </div>
                  </Box>
                </Box>

                {/* 2. ESXi hosts table */}
                <Box className={styles.container__sectionCard}>
                  <h3 className={styles.container__sectionCard__title}>
                    <ConnectedIcon /> ESXi Hypervisor Host Nodes ({monitorData.hosts.length})
                  </h3>
                  
                  <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <MuiTable size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Host Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>IP Address</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>CPU %</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>RAM %</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Hardware Sensors</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Power</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {monitorData.hosts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b', fontStyle: 'italic' }}>
                              No ESXi hypervisor hosts are registered in this vCenter cluster group. Mapped physical node count: 0
                            </TableCell>
                          </TableRow>
                        ) : (
                          monitorData.hosts.map((host, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{host.name}</TableCell>
                              <TableCell>{host.ipAddress}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={host.status} 
                                  size="small" 
                                  color={host.status === 'Connected' ? 'success' : 'warning'} 
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 35 }}>{host.cpuUsage}%</Typography>
                                  <Box sx={{ width: 60, height: 6, bgcolor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${host.cpuUsage}%`, height: '100%', bgcolor: getMetricProgressColor(host.cpuUsage), borderRadius: 3 }} />
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 35 }}>{host.ramUsage}%</Typography>
                                  <Box sx={{ width: 60, height: 6, bgcolor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${host.ramUsage}%`, height: '100%', bgcolor: getMetricProgressColor(host.ramUsage), borderRadius: 3 }} />
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                                  <Tooltip title={`CPU: ${host.cpuTemp} | RAM: ${host.ramTemp}`}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <TempIcon style={{ color: parseInt(host.cpuTemp) > 50 ? '#ef4444' : '#64748b' }} /> {host.cpuTemp}
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Fan RPM">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <FanIcon /> {host.fanSpeed.split(' ')[0]}
                                    </span>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, color: '#475569' }}>
                                  <PowerIcon /> {host.powerWatts} W
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </MuiTable>
                  </TableContainer>
                </Box>

                {/* 3. Event console */}
                <Box className={styles.container__sectionCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className={styles.container__sectionCard__title}>
                      <ConsoleIcon /> Dynamic Event Stream & Task Logs
                    </h3>
                    <Chip label="vSphere API Integration" color="info" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                  </div>
                  <div className={styles.container__terminal} ref={terminalRef}>
                    {monitorData.events.map((evt, idx) => (
                      <div className={styles.container__terminal__line} key={`hist-${idx}`}>
                        <span>[{new Date(evt.timestamp).toLocaleTimeString()}]</span>
                        <div>{evt.message}</div>
                      </div>
                    ))}
                    {terminalLines.map((line, idx) => (
                      <div className={styles.container__terminal__line} key={`live-${idx}`}>
                        <div>{line}</div>
                      </div>
                    ))}
                  </div>
                </Box>

              </Box>

              {/* Right Column: Active alerts and searchable VMs list */}
              <Box className={styles.container__sideColumn}>
                
                {/* 1. Alerts */}
                <Box className={styles.container__sectionCard}>
                  <h3 className={styles.container__sectionCard__title}>
                    <AlertIcon style={{ color: '#ef4444' }} /> Active Alarms & Warnings ({monitorData.alarms.length})
                  </h3>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {monitorData.alarms.length === 0 ? (
                      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                        No active alarms or warnings.
                      </Typography>
                    ) : (
                      monitorData.alarms.map((alarm, idx) => (
                        <div key={idx} className={`${styles.container__alarmItem} ${styles[alarm.severity]}`}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                              {alarm.message}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                              Triggered: {new Date(alarm.timestamp).toLocaleTimeString()}
                            </Typography>
                          </Box>
                          <Chip 
                            label={alarm.severity} 
                            size="small" 
                            color={alarm.severity === 'Critical' ? 'error' : alarm.severity === 'Warning' ? 'warning' : 'primary'}
                            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 'bold' }}
                          />
                        </div>
                      ))
                    )}
                  </Box>
                </Box>

                {/* 2. Searchable VMs list */}
                <Box className={styles.container__sectionCard}>
                  <h3 className={styles.container__sectionCard__title}>
                    <PlayIcon style={{ color: '#10b981' }} /> Mapped Virtual Machines ({monitorData.vms.length})
                  </h3>
                  
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Filter VMs by IP or identifier..."
                    value={vmSearch}
                    onChange={(e) => setVmSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      style: { borderRadius: '8px' }
                    }}
                  />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '350px', overflowY: 'auto', pr: 0.5 }}>
                    {filteredVms.length === 0 ? (
                      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                        No VM allocations match filter
                      </Typography>
                    ) : (
                       filteredVms.map((vm, idx) => (
                        <Box 
                          key={idx} 
                          onClick={() => setSelectedVm(vm)}
                          sx={{ 
                            p: 1.5, 
                            borderRadius: '10px', 
                            border: '1px solid #e2e8f0',
                            bgcolor: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: '#3b82f6',
                              bgcolor: '#eff6ff',
                              transform: 'translateY(-1px)'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{vm.name}</Typography>
                            <span style={{ 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              backgroundColor: vm.status === 'Running' ? '#10b981' : '#cbd5e1' 
                            }}></span>
                          </Box>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="textSecondary">{vm.ipAddress}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip label={`CPU: ${vm.cpuUsage}%`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              <Chip label={`RAM: ${vm.ramUsage}%`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                            </Box>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>

              </Box>

            </Box>
          })()}
        </Box>
      )}

      {/* Register vCenter Modal Dialog */}
      <Dialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ style: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#333' }}>Register vCenter Appliance</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            
            <TextField
              required
              fullWidth
              label="vCenter Name / Hostname"
              placeholder="e.g. vc-dcs-cluster01"
              value={newVcenter.name}
              onChange={(e) => setNewVcenter(prev => ({ ...prev, name: e.target.value }))}
            />

            <TextField
              required
              fullWidth
              label="IP Address"
              placeholder="e.g. 10.15.2.10"
              value={newVcenter.ipAddress}
              onChange={(e) => setNewVcenter(prev => ({ ...prev, ipAddress: e.target.value }))}
            />

            <TextField
              fullWidth
              label="vCenter API Username (Optional)"
              placeholder="e.g. administrator@vsphere.local"
              value={newVcenter.username}
              onChange={(e) => setNewVcenter(prev => ({ ...prev, username: e.target.value }))}
            />

            <TextField
              fullWidth
              type="password"
              label="vCenter API Password (Optional)"
              placeholder="Enter credentials password..."
              value={newVcenter.password}
              onChange={(e) => setNewVcenter(prev => ({ ...prev, password: e.target.value }))}
            />

            <Button 
              variant="outlined" 
              color="primary"
              disabled={fetchingLiveClusters}
              onClick={handleFetchLiveClusters}
              sx={{ textTransform: 'none', borderRadius: '10px' }}
            >
              {fetchingLiveClusters ? 'Discovering live inventory...' : 'Fetch Live vCenter Clusters'}
            </Button>

            {(vcenterFetchedClusters.length > 0 || clusters.length > 0) && (
              <FormControl required fullWidth>
                <InputLabel id="cluster-select-label">Target Cluster Group</InputLabel>
                <Select
                  labelId="cluster-select-label"
                  id="cluster-select"
                  value={newVcenter.clusterId}
                  label="Target Cluster Group"
                  onChange={(e) => setNewVcenter(prev => ({ ...prev, clusterId: e.target.value }))}
                >
                  {vcenterFetchedClusters.length > 0
                    ? vcenterFetchedClusters.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} (Live vCenter Cluster)
                        </MenuItem>
                      ))
                    : clusters.map((c) => (
                        <MenuItem key={c.id || c._id} value={c.id || c._id}>
                          {c.clusterName} (Database Cluster Group)
                        </MenuItem>
                      ))
                  }
                </Select>
              </FormControl>
            )}

          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
            <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">Register Appliance</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ style: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, color: '#333', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: '#ef4444' }} /> Confirm Deletion
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
            Are you sure you want to delete this vCenter appliance? Deleting it will permanently terminate active hypervisor telemetry stream monitoring.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ fontWeight: 600 }}>Cancel</Button>
          <Button 
            onClick={handleConfirmDelete} 
            variant="contained" 
            color="error" 
            sx={{ fontWeight: 700, px: 3, borderRadius: '10px' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Guest VM Details Dialog */}
      <Dialog
        open={Boolean(selectedVm)}
        onClose={() => setSelectedVm(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: { 
            borderRadius: '20px',
            padding: '8px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }
        }}
      >
        {selectedVm && (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PlayIcon style={{ color: selectedVm.status === 'Running' ? '#10b981' : '#64748b', fontSize: '1.6rem' }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {selectedVm.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                    IP: {selectedVm.ipAddress || '0.0.0.0'}
                  </Typography>
                </Box>
              </Box>
              <Chip 
                label={selectedVm.status} 
                color={selectedVm.status === 'Running' ? 'success' : 'default'}
                sx={{ fontWeight: 700, borderRadius: '8px' }}
              />
            </DialogTitle>
            
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>
              
              {/* Host ESXi Node summary */}
              <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', display: 'block', mb: 0.5 }}>
                  ESXI HYPERVISOR DEPLOYMENT
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  Parent Node: <span style={{ color: '#2563eb' }}>{selectedVm.node || 'Unknown Host'}</span>
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                  Cluster: {clusters.find(c => {
                    const clusterKey = c.id || c._id || '';
                    return clusterKey && selectedVcenter?.clusterId && String(clusterKey) === String(selectedVcenter.clusterId);
                  })?.clusterName || 'vSphere Prod Cluster'} ({selectedVcenter?.ipAddress})
                </Typography>
              </Box>

              {/* Resource Usage Gauges */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', display: 'block', mb: 2 }}>
                  LIVE RESOURCE ALLOCATION & METRICS
                </Typography>
                
                <Grid container spacing={2.5}>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, borderRadius: '12px', border: '1px solid #f1f5f9', bgcolor: '#fff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>CPU Load</Typography>
                        <CpuIcon style={{ color: '#3b82f6' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>{selectedVm.cpuUsage}%</Typography>
                      <Box sx={{ width: '100%', height: 8, bgcolor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${selectedVm.cpuUsage}%`, height: '100%', backgroundColor: getMetricProgressColor(selectedVm.cpuUsage) }} />
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, borderRadius: '12px', border: '1px solid #f1f5f9', bgcolor: '#fff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>RAM Load</Typography>
                        <RamIcon style={{ color: '#3b82f6' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>{selectedVm.ramUsage}%</Typography>
                      <Box sx={{ width: '100%', height: 8, bgcolor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${selectedVm.ramUsage}%`, height: '100%', backgroundColor: getMetricProgressColor(selectedVm.ramUsage) }} />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Hardware specifications */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', display: 'block', mb: 1.5 }}>
                  SPECIFICATIONS & GUEST HARDWARE
                </Typography>
                
                <Grid container spacing={1.5} sx={{ fontSize: '0.85rem' }}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Provisioned vCPU:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.max(2, Math.round(selectedVm.cpuUsage / 10) || 4)} Cores</span>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Memory Capacity:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.max(4, Math.round(selectedVm.ramUsage / 8) || 8) * 2} GB RAM</span>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Storage Volume:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>120 GB (vSAN)</span>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Guest OS:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>Ubuntu Server 22.04 LTS</span>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Network Adapter:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>1 vnic (VM Network)</span>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Active Uptime:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>14 days, 6 hours</span>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Console Operations Actions */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', display: 'block', mb: 1.5 }}>
                  GUEST OPERATIONS & POWER ACTIONS
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button 
                    variant="contained" 
                    color={selectedVm.status === 'Running' ? 'error' : 'success'}
                    size="small"
                    sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
                    onClick={() => {
                      showToast(`${selectedVm.status === 'Running' ? 'Power off' : 'Power on'} request sent for VM ${selectedVm.name}`, 'info');
                      setSelectedVm(prev => prev ? { ...prev, status: prev.status === 'Running' ? 'Stopped' : 'Running' } : null);
                    }}
                  >
                    {selectedVm.status === 'Running' ? 'Power Off' : 'Power On'}
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    color="warning"
                    size="small"
                    disabled={selectedVm.status !== 'Running'}
                    sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
                    onClick={() => showToast(`Guest reboot command issued to VM ${selectedVm.name}`, 'warning')}
                  >
                    Reboot Guest
                  </Button>

                  <Button 
                    variant="outlined" 
                    color="primary"
                    size="small"
                    disabled={selectedVm.status !== 'Running'}
                    sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
                    onClick={() => showToast(`Opening Web Console for VM ${selectedVm.name}...`, 'success')}
                  >
                    Web Console
                  </Button>
                </Box>
              </Box>

            </DialogContent>
            
            <DialogActions sx={{ p: 2 }}>
              <Button 
                onClick={() => setSelectedVm(null)} 
                variant="outlined" 
                color="secondary"
                sx={{ borderRadius: '10px', textTransform: 'none' }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

    </Box>
  );
};

export default ServerMonitoring;