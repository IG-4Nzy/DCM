// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Box, Button, Typography, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Select,
  MenuItem, InputLabel, FormControl, TextField as MuiTextField, Tooltip, Switch,
  CircularProgress, Paper
} from '@mui/material';
import {
  MdAdd as AddIcon,
  MdDelete as DeleteIcon,
  MdEdit as EditIcon,
  MdArrowBack as BackIcon,
  MdRefresh as RefreshIcon,
  MdCheckCircle as CheckIcon,
  MdError as ErrorIcon,
  MdCancel as CancelIcon,
  MdMonitorHeart as MetricsIcon,
  MdDns as ServerIcon,
  MdSpeed as SpeedIcon,
  MdMemory as MemoryIcon,
  MdStorage as StorageIcon,
  MdDeviceThermostat as TempIcon,
  MdNetworkCheck as NetworkIcon,
  MdTimer as TimerIcon,
  MdTrendingUp as TrendIcon,
  MdCircle as DotIcon,
} from 'react-icons/md';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import styles from './index.module.scss';
import {
  fetchApplications, createApplication, updateApplication, deleteApplication,
  addTarget, updateTarget, deleteTarget, liveScrapeApplication
} from './action';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';

// ────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────
const MAX_HISTORY = 30;
const CHART_COLORS = {
  cpu: '#6366f1',
  cpuGradient: '#818cf8',
  ram: '#8b5cf6',
  ramGradient: '#a78bfa',
  gpu: '#06b6d4',
  gpuGradient: '#22d3ee',
  kvCache: '#f59e0b',
  throughput: '#10b981',
  queue: '#ef4444',
  disk: '#6366f1',
  network: '#10b981',
  networkTx: '#8b5cf6',
  power: '#f97316',
  temp: '#ef4444',
};

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
const formatBytes = (bytes: number | null, decimals = 2): string => {
  if (bytes === null || bytes === undefined) return 'N/A';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

const getGaugeColor = (pct: number) => {
  if (pct < 60) return styles.gaugeGreen;
  if (pct < 85) return styles.gaugeYellow;
  return styles.gaugeRed;
};

const getGaugeTextColor = (pct: number) => {
  if (pct < 60) return '#10b981';
  if (pct < 85) return '#f59e0b';
  return '#ef4444';
};

const getTempClass = (temp: number) => {
  if (temp < 70) return styles.tempNormal;
  if (temp < 85) return styles.tempWarm;
  return styles.tempHot;
};

const formatTime = (ts: string) => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
};

// ────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────

const StatusChip = ({ status }: { status: string }) => {
  if (status === 'UP' || status === 'OK') return <span className={styles.statusUp}><CheckIcon size={12} /> UP</span>;
  if (status === 'DOWN') return <span className={styles.statusDown}><ErrorIcon size={12} /> DOWN</span>;
  return <span className={styles.statusError}><CancelIcon size={12} /> {status}</span>;
};

const GaugeBar = ({ percent, color }: { percent: number; color?: string }) => {
  const colorClass = color || getGaugeColor(percent);
  return (
    <div className={styles.gaugeContainer}>
      <div className={styles.gaugeBar}>
        <div className={`${styles.gaugeFill} ${colorClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className={styles.gaugePercent} style={{ color: getGaugeTextColor(percent) }}>{percent}%</span>
    </div>
  );
};

// ── Custom Recharts Tooltip ──
const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipLabel}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className={styles.chartTooltipValue} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{unit || ''}
        </div>
      ))}
    </div>
  );
};

// ── Radial Gauge Chart (for current utilization values) ──
const RadialGauge = ({ value, label, color, maxValue = 100 }: { value: number; label: string; color: string; maxValue?: number }) => {
  const data = [{ name: label, value, fill: color }];
  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={120}>
        <RadialBarChart
          innerRadius="65%" outerRadius="100%"
          data={data} startAngle={180} endAngle={0}
          barSize={10}
        >
          <RadialBar background clockWise dataKey="value" cornerRadius={5} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -30 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value != null ? `${value}%` : 'N/A'}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
};

// ── Node Exporter Metrics Display ──
const NodeMetricsDisplay = ({ data }: { data: any }) => {
  if (!data) return <span className={styles.noData}>No node metrics available</span>;

  return (
    <div>
      <div className={styles.metricsGrid}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>CPU Usage</span>
          {data.cpuUsagePercent != null ? (
            <GaugeBar percent={data.cpuUsagePercent} />
          ) : (
            <span className={styles.noData}>N/A</span>
          )}
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>CPU Cores</span>
          <span className={styles.metricValue}>{data.cpuCount ?? 'N/A'}</span>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>RAM Usage</span>
          {data.ramUsagePercent != null ? (
            <GaugeBar percent={data.ramUsagePercent} />
          ) : (
            <span className={styles.noData}>N/A</span>
          )}
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>RAM</span>
          <span className={styles.metricValueSmall}>
            {formatBytes(data.ramUsedBytes)} / {formatBytes(data.ramTotalBytes)}
          </span>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Load Average</span>
          <span className={styles.metricValueSmall}>
            {data.loadAverage?.load1 ?? '-'} / {data.loadAverage?.load5 ?? '-'} / {data.loadAverage?.load15 ?? '-'}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Uptime</span>
          <span className={styles.metricValueSmall}>{data.uptimeHuman ?? 'N/A'}</span>
        </div>
      </div>

      {/* Disks */}
      {data.disks && data.disks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span className={styles.metricLabel}>Disk Usage</span>
          {data.disks.map((d: any, i: number) => (
            <div key={i} className={styles.diskRow}>
              <Tooltip title={d.mountpoint}>
                <span className={styles.diskMount}>{d.mountpoint}</span>
              </Tooltip>
              <div style={{ flex: 1 }}>
                <GaugeBar percent={d.usagePercent} />
              </div>
              <span style={{ fontSize: 11, color: '#6b7280', minWidth: 80, textAlign: 'right' }}>
                {formatBytes(d.usedBytes)} / {formatBytes(d.totalBytes)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Networks */}
      {data.networks && data.networks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span className={styles.metricLabel}>Network (cumulative bytes)</span>
          {data.networks.map((n: any, i: number) => (
            <div key={i} className={styles.networkRow}>
              <span className={styles.networkIface}>{n.interface}</span>
              <span style={{ color: '#10b981', fontWeight: 500, fontSize: 12 }}>↓ {formatBytes(n.rxBytes)}</span>
              <span style={{ color: '#6366f1', fontWeight: 500, fontSize: 12 }}>↑ {formatBytes(n.txBytes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── DCGM Metrics Display ──
const DcgmMetricsDisplay = ({ data }: { data: any }) => {
  if (!data) return <span className={styles.noData}>No GPU metrics available</span>;

  return (
    <div>
      {data.gpus && data.gpus.length > 0 && (
        <div className={styles.gpuGrid}>
          {data.gpus.map((gpu: any, i: number) => (
            <div key={i} className={styles.gpuCard}>
              <div className={styles.gpuCardTitle}>
                GPU {gpu.gpuId} {gpu.gpuModel && `• ${gpu.gpuModel}`}
              </div>

              {gpu.gpuUtilPercent != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Utilization</span>
                  <span className={styles.gpuMetricValue} style={{ color: getGaugeTextColor(gpu.gpuUtilPercent) }}>
                    {gpu.gpuUtilPercent}%
                  </span>
                </div>
              )}

              {gpu.fbUsagePercent != null && (
                <>
                  <div className={styles.gpuMetricRow}>
                    <span className={styles.gpuMetricLabel}>Memory</span>
                    <span className={styles.gpuMetricValue} style={{ color: getGaugeTextColor(gpu.fbUsagePercent) }}>
                      {gpu.fbUsagePercent}%
                    </span>
                  </div>
                  <div className={styles.gpuMetricRow}>
                    <span className={styles.gpuMetricLabel}></span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {gpu.fbUsedMB?.toFixed(0)} / {gpu.fbTotalMB?.toFixed(0)} MB
                    </span>
                  </div>
                </>
              )}

              {gpu.temperatureC != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Temperature</span>
                  <span className={`${styles.gpuMetricValue} ${getTempClass(gpu.temperatureC)}`}>
                    {gpu.temperatureC}°C
                  </span>
                </div>
              )}

              {gpu.powerWatts != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Power</span>
                  <span className={styles.gpuMetricValue}>{gpu.powerWatts} W</span>
                </div>
              )}

              {gpu.smClockMHz != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>SM Clock</span>
                  <span className={styles.gpuMetricValue}>{gpu.smClockMHz} MHz</span>
                </div>
              )}

              {gpu.memClockMHz != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Mem Clock</span>
                  <span className={styles.gpuMetricValue}>{gpu.memClockMHz} MHz</span>
                </div>
              )}

              {(gpu.pcieTxKBps != null || gpu.pcieRxKBps != null) && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>PCIe</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    ↓{formatBytes((gpu.pcieRxKBps || 0) * 1024)}/s  ↑{formatBytes((gpu.pcieTxKBps || 0) * 1024)}/s
                  </span>
                </div>
              )}

              {gpu.memCopyUtilPercent != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Mem Copy Util</span>
                  <span className={styles.gpuMetricValue}>{gpu.memCopyUtilPercent}%</span>
                </div>
              )}

              {gpu.encoderUtilPercent != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Encoder Util</span>
                  <span className={styles.gpuMetricValue}>{gpu.encoderUtilPercent}%</span>
                </div>
              )}

              {gpu.decoderUtilPercent != null && (
                <div className={styles.gpuMetricRow}>
                  <span className={styles.gpuMetricLabel}>Decoder Util</span>
                  <span className={styles.gpuMetricValue}>{gpu.decoderUtilPercent}%</span>
                </div>
              )}

              {/* GPU Utilization Gauge */}
              {gpu.gpuUtilPercent != null && (
                <div style={{ marginTop: 6 }}>
                  <GaugeBar percent={gpu.gpuUtilPercent} color={styles.gaugeBlue} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inference / vLLM / Triton Metrics */}
      {data.inference && Object.keys(data.inference).length > 0 && (
        <div className={styles.inferenceSection}>
          <div className={styles.inferenceSectionTitle}>Inference Metrics</div>
          <div className={styles.inferenceGrid}>
            {data.inference.kvCacheUsagePercent != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>KV Cache Usage</span>
                <GaugeBar percent={data.inference.kvCacheUsagePercent} />
              </div>
            )}
            {data.inference.gpuCacheUsagePercent != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>GPU Cache Usage</span>
                <GaugeBar percent={data.inference.gpuCacheUsagePercent} />
              </div>
            )}
            {data.inference.numRequestsRunning != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Requests Running</span>
                <span className={styles.metricValue}>{data.inference.numRequestsRunning}</span>
              </div>
            )}
            {data.inference.numRequestsWaiting != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Requests Waiting (Queue)</span>
                <span className={styles.metricValue}>{data.inference.numRequestsWaiting}</span>
              </div>
            )}
            {data.inference.generationThroughputToksPerSec != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Throughput</span>
                <span className={styles.metricValue}>{data.inference.generationThroughputToksPerSec} tok/s</span>
              </div>
            )}
            {data.inference.inferenceQueueDurationUs != null && (
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Queue Duration</span>
                <span className={styles.metricValue}>{(data.inference.inferenceQueueDurationUs / 1000).toFixed(2)} ms</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────

const MetricsMonitoring: React.FC = () => {
  const { isSuperuser } = useSelector((state: RootState) => state.auth);

  const canView = isSuperuser || hasPrivilege(PRIVILEGES.VIEW_METRICS_MONITORING) || hasPrivilege(PRIVILEGES.CREATE_UPDATE_METRICS_MONITORING) || hasPrivilege(PRIVILEGES.DELETE_METRICS_MONITORING);
  const canCreateUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CREATE_UPDATE_METRICS_MONITORING);
  const canDelete = isSuperuser || hasPrivilege(PRIVILEGES.DELETE_METRICS_MONITORING);

  // ── State ──
  const [applications, setApplications] = useState<any[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [liveData, setLiveData] = useState<any | null>(null);
  const [liveScraping, setLiveScraping] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // ── History for charts ──
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  // ── Modals ──
  const [showAppModal, setShowAppModal] = useState(false);
  const [editingApp, setEditingApp] = useState<any | null>(null);
  const [appForm, setAppForm] = useState({ name: '', description: '' });

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingTargetIdx, setEditingTargetIdx] = useState<number | null>(null);
  const [targetForm, setTargetForm] = useState({
    ip: '', port: 9100, exporterType: 'node_exporter',
    monitoringTypes: ['ping', 'port', 'metrics'], label: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id?: string; idx?: number } | null>(null);

  // ── Data Loading ──
  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApplications({ search: searchTerm, limit: 200 });
      setApplications(data.data || []);
      setTotalApps(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const doLiveScrape = useCallback(async () => {
    if (!selectedApp) return;
    setLiveScraping(true);
    try {
      const data = await liveScrapeApplication(selectedApp.id);
      setLiveData(data);

      // Accumulate history for charts
      const timestamp = formatTime(data.scrapedAt || new Date().toISOString());
      const historyPoint: any = { time: timestamp };

      // Aggregate across all targets
      const targets = data.targets || [];
      let cpuSum = 0, cpuCount = 0, ramSum = 0, ramCount = 0;
      let gpuSum = 0, gpuCount = 0, kvSum = 0, kvCount = 0;
      let throughputSum = 0, tpCount = 0, queueSum = 0, queueCount = 0;

      targets.forEach((t: any) => {
        if (t.nodeMetrics) {
          if (t.nodeMetrics.cpuUsagePercent != null) { cpuSum += t.nodeMetrics.cpuUsagePercent; cpuCount++; }
          if (t.nodeMetrics.ramUsagePercent != null) { ramSum += t.nodeMetrics.ramUsagePercent; ramCount++; }
        }
        if (t.dcgmMetrics?.gpus) {
          t.dcgmMetrics.gpus.forEach((g: any) => {
            if (g.gpuUtilPercent != null) { gpuSum += g.gpuUtilPercent; gpuCount++; }
          });
          if (t.dcgmMetrics.inference) {
            const inf = t.dcgmMetrics.inference;
            if (inf.kvCacheUsagePercent != null) { kvSum += inf.kvCacheUsagePercent; kvCount++; }
            if (inf.generationThroughputToksPerSec != null) { throughputSum += inf.generationThroughputToksPerSec; tpCount++; }
            if (inf.numRequestsWaiting != null) { queueSum += inf.numRequestsWaiting; queueCount++; }
          }
        }
      });

      historyPoint.cpu = cpuCount > 0 ? parseFloat((cpuSum / cpuCount).toFixed(1)) : null;
      historyPoint.ram = ramCount > 0 ? parseFloat((ramSum / ramCount).toFixed(1)) : null;
      historyPoint.gpu = gpuCount > 0 ? parseFloat((gpuSum / gpuCount).toFixed(1)) : null;
      historyPoint.kvCache = kvCount > 0 ? parseFloat((kvSum / kvCount).toFixed(1)) : null;
      historyPoint.throughput = tpCount > 0 ? parseFloat((throughputSum / tpCount).toFixed(1)) : null;
      historyPoint.queue = queueCount > 0 ? Math.round(queueSum / queueCount) : null;

      setMetricsHistory(prev => {
        const next = [...prev, historyPoint];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    } catch (err) {
      console.error('Live scrape failed:', err);
    } finally {
      setLiveScraping(false);
    }
  }, [selectedApp]);

  // Auto-refresh logic
  useEffect(() => {
    if (selectedApp) {
      doLiveScrape();
      if (autoRefresh) {
        autoRefreshRef.current = setInterval(doLiveScrape, 15000);
      }
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefresh, selectedApp, doLiveScrape]);

  // ── Handlers ──
  const handleSelectApp = async (app: any) => {
    setSelectedApp(app);
    setLiveData(null);
    setMetricsHistory([]);
    setAutoRefresh(false);
  };

  const handleBackToList = () => {
    setSelectedApp(null);
    setLiveData(null);
    setMetricsHistory([]);
    setAutoRefresh(false);
    loadApplications();
  };

  // Application CRUD
  const handleSaveApp = async () => {
    try {
      if (editingApp) {
        const updated = await updateApplication(editingApp.id, appForm);
        setSelectedApp(updated);
      } else {
        await createApplication(appForm);
      }
      setShowAppModal(false);
      setEditingApp(null);
      setAppForm({ name: '', description: '' });
      loadApplications();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join(', ') : detail;
      alert(msg || 'Failed to save application');
    }
  };

  const handleDeleteApp = async (id: string) => {
    try {
      await deleteApplication(id);
      setDeleteConfirm(null);
      if (selectedApp?.id === id) handleBackToList();
      else loadApplications();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Target CRUD
  const handleSaveTarget = async () => {
    if (!selectedApp) return;
    try {
      let updated;
      if (editingTargetIdx !== null) {
        updated = await updateTarget(selectedApp.id, editingTargetIdx, targetForm);
      } else {
        updated = await addTarget(selectedApp.id, targetForm);
      }
      setSelectedApp(updated);
      setShowTargetModal(false);
      setEditingTargetIdx(null);
      setTargetForm({ ip: '', port: 9100, exporterType: 'node_exporter', monitoringTypes: ['ping', 'port', 'metrics'], label: '' });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join(', ') : detail;
      alert(msg || 'Failed to save target');
    }
  };

  const handleDeleteTarget = async (idx: number) => {
    if (!selectedApp) return;
    try {
      const updated = await deleteTarget(selectedApp.id, idx);
      setSelectedApp(updated);
      setDeleteConfirm(null);
      setLiveData(null);
    } catch (err) {
      console.error('Delete target failed:', err);
    }
  };

  const openEditApp = (app: any) => {
    setEditingApp(app);
    setAppForm({ name: app.name, description: app.description || '' });
    setShowAppModal(true);
  };

  const openAddTarget = () => {
    setEditingTargetIdx(null);
    setTargetForm({ ip: '', port: 9100, exporterType: 'node_exporter', monitoringTypes: ['ping', 'port', 'metrics'], label: '' });
    setShowTargetModal(true);
  };

  const openEditTarget = (idx: number, target: any) => {
    setEditingTargetIdx(idx);
    setTargetForm({
      ip: target.ip,
      port: target.port,
      exporterType: target.exporterType,
      monitoringTypes: target.monitoringTypes || ['ping', 'port', 'metrics'],
      label: target.label || '',
    });
    setShowTargetModal(true);
  };

  const toggleMonitoringType = (type: string) => {
    setTargetForm(prev => {
      const types = prev.monitoringTypes.includes(type)
        ? prev.monitoringTypes.filter(t => t !== type)
        : [...prev.monitoringTypes, type];
      return { ...prev, monitoringTypes: types.length > 0 ? types : [type] };
    });
  };

  // ── Computed summary from latest liveData ──
  const summary = useMemo(() => {
    if (!liveData?.targets) return null;
    const targets = liveData.targets;
    let cpuSum = 0, cpuN = 0, ramSum = 0, ramN = 0, gpuSum = 0, gpuN = 0;
    targets.forEach((t: any) => {
      if (t.nodeMetrics?.cpuUsagePercent != null) { cpuSum += t.nodeMetrics.cpuUsagePercent; cpuN++; }
      if (t.nodeMetrics?.ramUsagePercent != null) { ramSum += t.nodeMetrics.ramUsagePercent; ramN++; }
      if (t.dcgmMetrics?.gpus) {
        t.dcgmMetrics.gpus.forEach((g: any) => {
          if (g.gpuUtilPercent != null) { gpuSum += g.gpuUtilPercent; gpuN++; }
        });
      }
    });
    return {
      avgCpu: cpuN > 0 ? parseFloat((cpuSum / cpuN).toFixed(1)) : null,
      avgRam: ramN > 0 ? parseFloat((ramSum / ramN).toFixed(1)) : null,
      avgGpu: gpuN > 0 ? parseFloat((gpuSum / gpuN).toFixed(1)) : null,
      total: liveData.summary?.total || 0,
      up: liveData.summary?.up || 0,
      down: liveData.summary?.down || 0,
    };
  }, [liveData]);

  // ────────────────────────────────────────────────────
  // Render: Application List View
  // ────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <MetricsIcon size={26} style={{ color: '#6366f1' }} />
            Metrics Monitoring
          </h1>
        </div>
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="textSecondary">
            You need the View Metrics Monitoring privilege to access this feature.
          </Typography>
        </Box>
      </div>
    );
  }

  if (!selectedApp) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <MetricsIcon size={26} style={{ color: '#6366f1' }} />
            Metrics Monitoring
          </h1>
          <div className={styles.headerActions}>
            <MuiTextField
              size="small"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchBar}
              className={styles.searchBar}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            {canCreateUpdate && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setEditingApp(null); setAppForm({ name: '', description: '' }); setShowAppModal(true); }}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
                }}
              >
                Add Application
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingOverlay}><CircularProgress size={24} /><span>Loading applications...</span></div>
        ) : applications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><MetricsIcon size={48} /></div>
            <Typography variant="h6" color="textSecondary">No applications configured</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Add an application to start monitoring servers, GPUs, and inference metrics.
            </Typography>
          </div>
        ) : (
          <div className={styles.appsGrid}>
            {applications.map(app => (
              <div key={app.id} className={styles.appCard} onClick={() => handleSelectApp(app)}>
                <div className={styles.appCardHeader}>
                  <h3 className={styles.appName}>{app.name}</h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {canCreateUpdate && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditApp(app); }}>
                        <EditIcon size={16} />
                      </IconButton>
                    )}
                    {canDelete && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'app', id: app.id }); }}>
                        <DeleteIcon size={16} color="#ef4444" />
                      </IconButton>
                    )}
                  </div>
                </div>
                {app.description && <p className={styles.appDescription}>{app.description}</p>}
                <div className={styles.appCardStats}>
                  <span className={styles.statChip}><ServerIcon size={14} /> {app.targets?.length || 0} targets</span>
                  {app.createdBy && <span className={styles.statChip}>by {app.createdBy}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── App Create/Edit Modal ── */}
        <Modal open={showAppModal} handleClose={() => { setShowAppModal(false); setEditingApp(null); }} title={editingApp ? 'Edit Application' : 'Add Application'}>
          <Box sx={{ p: 2, minWidth: 400 }}>
            <div className={styles.formField}>
              <MuiTextField
                fullWidth size="small" label="Application Name" required
                value={appForm.name}
                onChange={(e) => setAppForm({ ...appForm, name: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <MuiTextField
                fullWidth size="small" label="Description" multiline rows={2}
                value={appForm.description}
                onChange={(e) => setAppForm({ ...appForm, description: e.target.value })}
              />
            </div>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={() => { setShowAppModal(false); setEditingApp(null); }} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveApp} disabled={!appForm.name.trim()}
                sx={{ textTransform: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {editingApp ? 'Update' : 'Create'}
              </Button>
            </Box>
          </Box>
        </Modal>

        {/* ── Delete Confirm Modal ── */}
        <Modal open={!!deleteConfirm} handleClose={() => setDeleteConfirm(null)} title="Confirm Delete">
          <Box sx={{ p: 2 }}>
            <Typography>Are you sure you want to delete this {deleteConfirm?.type}?</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button variant="contained" color="error"
                onClick={() => {
                  if (deleteConfirm?.type === 'app' && deleteConfirm.id) handleDeleteApp(deleteConfirm.id);
                  else if (deleteConfirm?.type === 'target' && deleteConfirm.idx !== undefined) handleDeleteTarget(deleteConfirm.idx);
                }}
                sx={{ textTransform: 'none', borderRadius: '8px' }}>
                Delete
              </Button>
            </Box>
          </Box>
        </Modal>
      </div>
    );
  }

  // ────────────────────────────────────────────────────
  // Render: Application Dashboard View
  // ────────────────────────────────────────────────────
  const targets = selectedApp.targets || [];

  return (
    <div className={styles.pageContainer}>
      {/* ── Header ── */}
      <div className={styles.detailHeader}>
        <IconButton className={styles.backButton} onClick={handleBackToList} size="small">
          <BackIcon />
        </IconButton>
        <div style={{ flex: 1 }}>
          <h2 className={styles.detailTitle}>{selectedApp.name}</h2>
          {selectedApp.description && <p className={styles.detailDescription}>{selectedApp.description}</p>}
        </div>
        <div className={styles.headerActions}>
          {liveData?.scrapedAt && (
            <span className={styles.lastScrapedBadge}>
              <TimerIcon size={12} /> Last: {formatTime(liveData.scrapedAt)}
            </span>
          )}
          <div className={styles.autoRefreshToggle}>
            <span>Auto-refresh</span>
            <Switch size="small" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          </div>
          <Tooltip title="Scrape all targets now">
            <span>
              <Button
                variant="outlined"
                startIcon={liveScraping ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={doLiveScrape}
                disabled={liveScraping || targets.length === 0}
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                {liveScraping ? 'Scraping...' : 'Live Scrape'}
              </Button>
            </span>
          </Tooltip>
          {canCreateUpdate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddTarget}
              sx={{
                borderRadius: '10px', textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
              }}
            >
              Add Target
            </Button>
          )}
          {canCreateUpdate && (
            <IconButton onClick={() => openEditApp(selectedApp)} size="small">
              <EditIcon />
            </IconButton>
          )}
        </div>
      </div>

      {/* ── Targets Table ── */}
      <div className={styles.sectionTitle}><ServerIcon size={16} /> Targets ({targets.length})</div>
      {targets.length === 0 ? (
        <div className={styles.emptyState}>
          <Typography variant="body2" color="textSecondary">No targets configured. Add a target with an IP, port, and exporter type.</Typography>
        </div>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: '12px', mb: 2 }} className={styles.targetsTable}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: '#f8f9fc' }}>
                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Port</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exporter</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Monitoring</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {targets.map((t: any, idx: number) => (
                <TableRow key={idx} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{t.label || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{t.ip}</TableCell>
                  <TableCell>{t.port}</TableCell>
                  <TableCell>
                    <Chip label={t.exporterType?.replace('_', ' ')} size="small"
                      sx={{
                        fontWeight: 500, fontSize: 11,
                        background: t.exporterType === 'dcgm_exporter' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: t.exporterType === 'dcgm_exporter' ? '#8b5cf6' : '#6366f1',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(t.monitoringTypes || []).map((mt: string) => (
                        <Chip key={mt} label={mt} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.actionButtons}>
                      <IconButton size="small" onClick={() => openEditTarget(idx, t)}><EditIcon size={15} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteConfirm({ type: 'target', idx })}><DeleteIcon size={15} color="#ef4444" /></IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Live Dashboard ── */}
      {liveData && (
        <div className={styles.metricsSection}>
          <div className={styles.sectionTitle}><SpeedIcon size={16} /> Live Dashboard</div>

          {/* ── Summary Cards ── */}
          <div className={styles.dashboardSummary}>
            <div className={`${styles.summaryCard} ${styles.summaryCardPrimary}`}>
              <div className={styles.summaryCardInner}>
                <div className={styles.summaryIconWrap} style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                  <ServerIcon size={22} color="#6366f1" />
                </div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue}>{summary?.total || 0}</div>
                  <div className={styles.summaryLabel}>Total Targets</div>
                </div>
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardSuccess}`}>
              <div className={styles.summaryCardInner}>
                <div className={styles.summaryIconWrap} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                  <CheckIcon size={22} color="#10b981" />
                </div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue} style={{ color: '#10b981' }}>{summary?.up || 0}</div>
                  <div className={styles.summaryLabel}>Targets Up</div>
                </div>
              </div>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardDanger}`}>
              <div className={styles.summaryCardInner}>
                <div className={styles.summaryIconWrap} style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                  <ErrorIcon size={22} color="#ef4444" />
                </div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryValue} style={{ color: '#ef4444' }}>{summary?.down || 0}</div>
                  <div className={styles.summaryLabel}>Targets Down</div>
                </div>
              </div>
            </div>
            {summary?.avgCpu != null && (
              <div className={`${styles.summaryCard} ${styles.summaryCardInfo}`}>
                <div className={styles.summaryCardInner}>
                  <div className={styles.summaryIconWrap} style={{ background: 'rgba(6, 182, 212, 0.1)' }}>
                    <SpeedIcon size={22} color="#06b6d4" />
                  </div>
                  <div className={styles.summaryContent}>
                    <div className={styles.summaryValue} style={{ color: getGaugeTextColor(summary.avgCpu) }}>{summary.avgCpu}%</div>
                    <div className={styles.summaryLabel}>Avg CPU</div>
                  </div>
                </div>
              </div>
            )}
            {summary?.avgRam != null && (
              <div className={`${styles.summaryCard} ${styles.summaryCardWarning}`}>
                <div className={styles.summaryCardInner}>
                  <div className={styles.summaryIconWrap} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                    <MemoryIcon size={22} color="#f59e0b" />
                  </div>
                  <div className={styles.summaryContent}>
                    <div className={styles.summaryValue} style={{ color: getGaugeTextColor(summary.avgRam) }}>{summary.avgRam}%</div>
                    <div className={styles.summaryLabel}>Avg RAM</div>
                  </div>
                </div>
              </div>
            )}
            {summary?.avgGpu != null && (
              <div className={`${styles.summaryCard} ${styles.summaryCardPrimary}`}>
                <div className={styles.summaryCardInner}>
                  <div className={styles.summaryIconWrap} style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <StorageIcon size={22} color="#8b5cf6" />
                  </div>
                  <div className={styles.summaryContent}>
                    <div className={styles.summaryValue} style={{ color: getGaugeTextColor(summary.avgGpu) }}>{summary.avgGpu}%</div>
                    <div className={styles.summaryLabel}>Avg GPU</div>
                  </div>
                </div>
              </div>
            )}
            {liveScraping && (
              <div className={styles.summaryCard}>
                <div className={styles.refreshingBadge}><CircularProgress size={14} /> Refreshing...</div>
              </div>
            )}
          </div>

          {/* ── Trend Charts (accumulated history) ── */}
          {metricsHistory.length > 1 && (
            <div className={styles.chartsRow}>
              {/* CPU & RAM Area Chart */}
              {(metricsHistory.some(h => h.cpu != null) || metricsHistory.some(h => h.ram != null)) && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>
                    <div className={styles.chartTitleIcon}><SpeedIcon size={16} /></div>
                    CPU & RAM Utilization
                  </div>
                  <div className={styles.chartSubtitle}>Trend over last {metricsHistory.length} scrapes</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={metricsHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.cpu} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.cpu} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradRam" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.ram} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.ram} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip content={<CustomTooltip unit="%" />} />
                      <Area type="monotone" dataKey="cpu" name="CPU" stroke={CHART_COLORS.cpu} fill="url(#gradCpu)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Area type="monotone" dataKey="ram" name="RAM" stroke={CHART_COLORS.ram} fill="url(#gradRam)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* GPU Utilization Chart */}
              {metricsHistory.some(h => h.gpu != null) && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>
                    <div className={styles.chartTitleIcon} style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}><StorageIcon size={16} /></div>
                    GPU Utilization
                  </div>
                  <div className={styles.chartSubtitle}>Average across all GPUs</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={metricsHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradGpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.gpu} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={CHART_COLORS.gpu} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                      <RechartsTooltip content={<CustomTooltip unit="%" />} />
                      <Area type="monotone" dataKey="gpu" name="GPU" stroke={CHART_COLORS.gpu} fill="url(#gradGpu)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: CHART_COLORS.gpu }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* KV Cache & Queue Chart */}
              {(metricsHistory.some(h => h.kvCache != null) || metricsHistory.some(h => h.queue != null)) && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>
                    <div className={styles.chartTitleIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><MemoryIcon size={16} /></div>
                    Inference: KV Cache & Queue
                  </div>
                  <div className={styles.chartSubtitle}>Cache utilization and waiting requests</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={metricsHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      {metricsHistory.some(h => h.kvCache != null) && (
                        <Line yAxisId="left" type="monotone" dataKey="kvCache" name="KV Cache %" stroke={CHART_COLORS.kvCache} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      )}
                      {metricsHistory.some(h => h.queue != null) && (
                        <Line yAxisId="right" type="stepAfter" dataKey="queue" name="Queue Depth" stroke={CHART_COLORS.queue} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Throughput Chart */}
              {metricsHistory.some(h => h.throughput != null) && (
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>
                    <div className={styles.chartTitleIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><TrendIcon size={16} /></div>
                    Generation Throughput
                  </div>
                  <div className={styles.chartSubtitle}>Tokens per second</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={metricsHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradThroughput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.throughput} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={CHART_COLORS.throughput} stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <RechartsTooltip content={<CustomTooltip unit=" tok/s" />} />
                      <Bar dataKey="throughput" name="Throughput" fill="url(#gradThroughput)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Per-Target Detail Cards ── */}
          <div className={styles.sectionTitle} style={{ marginTop: 8 }}><ServerIcon size={16} /> Per-Target Metrics</div>
          <div className={styles.targetMetricsGrid}>
            {(liveData.targets || []).map((t: any, idx: number) => (
              <div key={idx} className={styles.targetCard}>
                <div className={styles.targetCardHeader}>
                  <div className={styles.targetHeaderLeft}>
                    <div className={`${styles.targetStatusDot} ${t.overallStatus === 'UP' ? styles.up : t.overallStatus === 'DOWN' ? styles.down : styles.error}`} />
                    <div>
                      <div className={styles.targetLabel}>{t.label || `Target ${idx + 1}`}</div>
                      <div className={styles.targetIp}>{t.ip}:{(typeof t.port === 'object' ? t.port.port : t.port)} • {t.exporterType?.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <StatusChip status={t.overallStatus} />
                </div>
                <div className={styles.targetCardBody}>
                  {/* Ping & Port Status */}
                  <div className={styles.statusInline}>
                    {t.ping && (
                      <div className={styles.statusInlineItem}>
                        <DotIcon size={8} color={t.ping.status === 'UP' ? '#10b981' : '#ef4444'} />
                        Ping: {t.ping.status}
                        {t.ping.latencyMs != null && <span style={{ fontWeight: 600, color: '#374151' }}>{t.ping.latencyMs}ms</span>}
                      </div>
                    )}
                    {t.port && (
                      <div className={styles.statusInlineItem}>
                        <DotIcon size={8} color={t.port?.status === 'UP' ? '#10b981' : '#ef4444'} />
                        Port {(typeof t.port === 'object' ? t.port.port : t.port) || 'Unknown'}: {typeof t.port === 'object' ? t.port.status : 'N/A'}
                      </div>
                    )}
                  </div>

                  {/* Current Values as Mini Stats */}
                  {t.nodeMetrics && (
                    <>
                      <div className={styles.miniStatsRow}>
                        {t.nodeMetrics.cpuUsagePercent != null && (
                          <div className={styles.miniStat}>
                            <div className={styles.miniStatValue} style={{ color: getGaugeTextColor(t.nodeMetrics.cpuUsagePercent) }}>{t.nodeMetrics.cpuUsagePercent}%</div>
                            <div className={styles.miniStatLabel}>CPU</div>
                          </div>
                        )}
                        {t.nodeMetrics.ramUsagePercent != null && (
                          <div className={styles.miniStat}>
                            <div className={styles.miniStatValue} style={{ color: getGaugeTextColor(t.nodeMetrics.ramUsagePercent) }}>{t.nodeMetrics.ramUsagePercent}%</div>
                            <div className={styles.miniStatLabel}>RAM</div>
                          </div>
                        )}
                        {t.nodeMetrics.cpuCount != null && (
                          <div className={styles.miniStat}>
                            <div className={styles.miniStatValue}>{t.nodeMetrics.cpuCount}</div>
                            <div className={styles.miniStatLabel}>Cores</div>
                          </div>
                        )}
                        {t.nodeMetrics.loadAverage?.load1 != null && (
                          <div className={styles.miniStat}>
                            <div className={styles.miniStatValue} style={{ fontSize: 16 }}>{t.nodeMetrics.loadAverage.load1}</div>
                            <div className={styles.miniStatLabel}>Load 1m</div>
                          </div>
                        )}
                        {t.nodeMetrics.uptimeHuman && (
                          <div className={styles.miniStat}>
                            <div className={styles.miniStatValue} style={{ fontSize: 14 }}>{t.nodeMetrics.uptimeHuman}</div>
                            <div className={styles.miniStatLabel}>Uptime</div>
                          </div>
                        )}
                      </div>

                      {/* Detailed Disk and Network */}
                      <div className={styles.targetChartsGrid}>
                        {t.nodeMetrics.disks && t.nodeMetrics.disks.length > 0 && (
                          <div className={styles.targetChartWrap}>
                            <div className={styles.targetChartTitle}><StorageIcon size={14} /> Disk Usage</div>
                            <ResponsiveContainer width="100%" height={Math.max(80, t.nodeMetrics.disks.length * 45)}>
                              <BarChart data={t.nodeMetrics.disks.map((d: any) => ({ name: d.mountpoint, usage: d.usagePercent, total: d.totalBytes }))} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} width={70} />
                                <RechartsTooltip content={<CustomTooltip unit="%" />} />
                                <Bar dataKey="usage" name="Usage" fill={CHART_COLORS.disk} radius={[0, 4, 4, 0]} barSize={14} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        {t.nodeMetrics.networks && t.nodeMetrics.networks.length > 0 && (
                          <div className={styles.targetChartWrap}>
                            <div className={styles.targetChartTitle}><NetworkIcon size={14} /> Network I/O</div>
                            {t.nodeMetrics.networks.map((n: any, ni: number) => (
                              <div key={ni} className={styles.networkRow}>
                                <span className={styles.networkIface}>{n.interface}</span>
                                <span style={{ color: '#10b981', fontWeight: 500, fontSize: 12 }}>↓ {formatBytes(n.rxBytes)}</span>
                                <span style={{ color: '#6366f1', fontWeight: 500, fontSize: 12 }}>↑ {formatBytes(n.txBytes)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* DCGM Metrics */}
                  {t.dcgmMetrics && (
                    <>
                      <div className={styles.sectionTitle} style={{ fontSize: 12, margin: '16px 0 8px' }}>
                        <SpeedIcon size={14} /> GPU Metrics
                      </div>

                      {/* GPU Radial Gauges */}
                      {t.dcgmMetrics.gpus && t.dcgmMetrics.gpus.length > 0 && (
                        <div className={styles.gpuGrid}>
                          {t.dcgmMetrics.gpus.map((gpu: any, gi: number) => (
                            <div key={gi} className={styles.gpuCard}>
                              <div className={styles.gpuCardTitle}>
                                GPU {gpu.gpuId} {gpu.gpuModel && `• ${gpu.gpuModel}`}
                              </div>

                              {/* Radial gauges for key metrics */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                                {gpu.gpuUtilPercent != null && (
                                  <RadialGauge value={gpu.gpuUtilPercent} label="Util" color={CHART_COLORS.gpu} />
                                )}
                                {gpu.fbUsagePercent != null && (
                                  <RadialGauge value={gpu.fbUsagePercent} label="VRAM" color={CHART_COLORS.ram} />
                                )}
                              </div>

                              {gpu.fbUsedMB != null && gpu.fbTotalMB != null && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>VRAM</span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                                    {gpu.fbUsedMB?.toFixed(0)} / {gpu.fbTotalMB?.toFixed(0)} MB
                                  </span>
                                </div>
                              )}

                              {gpu.temperatureC != null && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>Temperature</span>
                                  <span className={`${styles.gpuMetricValue} ${getTempClass(gpu.temperatureC)}`}>
                                    {gpu.temperatureC}°C
                                  </span>
                                </div>
                              )}

                              {gpu.powerWatts != null && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>Power</span>
                                  <span className={styles.gpuMetricValue}>{gpu.powerWatts} W</span>
                                </div>
                              )}

                              {gpu.smClockMHz != null && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>SM Clock</span>
                                  <span className={styles.gpuMetricValue}>{gpu.smClockMHz} MHz</span>
                                </div>
                              )}

                              {gpu.memClockMHz != null && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>Mem Clock</span>
                                  <span className={styles.gpuMetricValue}>{gpu.memClockMHz} MHz</span>
                                </div>
                              )}

                              {(gpu.pcieTxKBps != null || gpu.pcieRxKBps != null) && (
                                <div className={styles.gpuMetricRow}>
                                  <span className={styles.gpuMetricLabel}>PCIe</span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                                    ↓{formatBytes((gpu.pcieRxKBps || 0) * 1024)}/s  ↑{formatBytes((gpu.pcieTxKBps || 0) * 1024)}/s
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inference Metrics */}
                      {t.dcgmMetrics.inference && Object.keys(t.dcgmMetrics.inference).length > 0 && (
                        <div className={styles.inferenceSection}>
                          <div className={styles.inferenceSectionTitle}>Inference Metrics</div>
                          <div className={styles.miniStatsRow}>
                            {t.dcgmMetrics.inference.kvCacheUsagePercent != null && (
                              <div className={styles.miniStat}>
                                <div className={styles.miniStatValue} style={{ color: CHART_COLORS.kvCache }}>{t.dcgmMetrics.inference.kvCacheUsagePercent}%</div>
                                <div className={styles.miniStatLabel}>KV Cache</div>
                              </div>
                            )}
                            {t.dcgmMetrics.inference.numRequestsRunning != null && (
                              <div className={styles.miniStat}>
                                <div className={styles.miniStatValue} style={{ color: CHART_COLORS.throughput }}>{t.dcgmMetrics.inference.numRequestsRunning}</div>
                                <div className={styles.miniStatLabel}>Running</div>
                              </div>
                            )}
                            {t.dcgmMetrics.inference.numRequestsWaiting != null && (
                              <div className={styles.miniStat}>
                                <div className={styles.miniStatValue} style={{ color: CHART_COLORS.queue }}>{t.dcgmMetrics.inference.numRequestsWaiting}</div>
                                <div className={styles.miniStatLabel}>Queue</div>
                              </div>
                            )}
                            {t.dcgmMetrics.inference.generationThroughputToksPerSec != null && (
                              <div className={styles.miniStat}>
                                <div className={styles.miniStatValue} style={{ color: CHART_COLORS.throughput }}>{t.dcgmMetrics.inference.generationThroughputToksPerSec}</div>
                                <div className={styles.miniStatLabel}>tok/s</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* If only ping/port, no exporter metrics */}
                  {!t.nodeMetrics && !t.dcgmMetrics && !t.metrics?.error && t.metrics?.status !== 'OK' && (
                    <span className={styles.noData}>No exporter metrics collected</span>
                  )}
                  {t.metrics?.error && !t.nodeMetrics && !t.dcgmMetrics && (
                    <span className={styles.noData}>Metrics error: {t.metrics.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Target Create/Edit Modal ── */}
      <Modal open={showTargetModal} handleClose={() => { setShowTargetModal(false); setEditingTargetIdx(null); }} title={editingTargetIdx !== null ? 'Edit Target' : 'Add Target'}>
        <Box sx={{ p: 2, minWidth: 450 }}>
          <div className={styles.formField}>
            <MuiTextField
              fullWidth size="small" label="Label (optional)"
              value={targetForm.label}
              onChange={(e) => setTargetForm({ ...targetForm, label: e.target.value })}
              placeholder="e.g. GPU Node 1"
            />
          </div>
          <div className={styles.formRow}>
            <MuiTextField
              size="small" label="IP Address" required sx={{ flex: 2 }}
              value={targetForm.ip}
              onChange={(e) => setTargetForm({ ...targetForm, ip: e.target.value })}
              placeholder="e.g. 10.0.1.5"
            />
            <MuiTextField
              size="small" label="Port" required sx={{ flex: 1 }} type="number"
              value={targetForm.port}
              onChange={(e) => setTargetForm({ ...targetForm, port: parseInt(e.target.value) || 9100 })}
            />
          </div>
          <div className={styles.formField} style={{ marginTop: 16 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Exporter Type</InputLabel>
              <Select
                value={targetForm.exporterType}
                label="Exporter Type"
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetForm(prev => ({
                    ...prev,
                    exporterType: val,
                    port: val === 'dcgm_exporter' ? 9400 : val === 'node_exporter' ? 9100 : prev.port,
                  }));
                }}
              >
                <MenuItem value="node_exporter">Node Exporter (CPU, RAM, Disk, Network)</MenuItem>
                <MenuItem value="dcgm_exporter">DCGM Exporter (GPU Metrics)</MenuItem>
                <MenuItem value="custom">Custom (Auto-detect)</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className={styles.formField}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#374151' }}>Monitoring Types</Typography>
            <div className={styles.chipGroup}>
              {['ping', 'port', 'metrics'].map(mt => (
                <Chip
                  key={mt}
                  label={mt.charAt(0).toUpperCase() + mt.slice(1)}
                  onClick={() => toggleMonitoringType(mt)}
                  color={targetForm.monitoringTypes.includes(mt) ? 'primary' : 'default'}
                  variant={targetForm.monitoringTypes.includes(mt) ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', fontWeight: 500 }}
                />
              ))}
            </div>
          </div>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={() => { setShowTargetModal(false); setEditingTargetIdx(null); }} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveTarget} disabled={!targetForm.ip.trim()}
              sx={{ textTransform: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {editingTargetIdx !== null ? 'Update' : 'Add'}
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* ── App Edit Modal ── */}
      <Modal open={showAppModal} handleClose={() => { setShowAppModal(false); setEditingApp(null); }} title="Edit Application">
        <Box sx={{ p: 2, minWidth: 400 }}>
          <div className={styles.formField}>
            <MuiTextField
              fullWidth size="small" label="Application Name" required
              value={appForm.name}
              onChange={(e) => setAppForm({ ...appForm, name: e.target.value })}
            />
          </div>
          <div className={styles.formField}>
            <MuiTextField
              fullWidth size="small" label="Description" multiline rows={2}
              value={appForm.description}
              onChange={(e) => setAppForm({ ...appForm, description: e.target.value })}
            />
          </div>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={() => { setShowAppModal(false); setEditingApp(null); }} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveApp} disabled={!appForm.name.trim()}
              sx={{ textTransform: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              Update
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleteConfirm} handleClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <Box sx={{ p: 2 }}>
          <Typography>Are you sure you want to delete this {deleteConfirm?.type}?</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="error"
              onClick={() => {
                if (deleteConfirm?.type === 'app' && deleteConfirm.id) handleDeleteApp(deleteConfirm.id);
                else if (deleteConfirm?.type === 'target' && deleteConfirm.idx !== undefined) handleDeleteTarget(deleteConfirm.idx);
              }}
              sx={{ textTransform: 'none', borderRadius: '8px' }}>
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default MetricsMonitoring;
