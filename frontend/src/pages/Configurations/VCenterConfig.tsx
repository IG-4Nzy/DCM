// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import request from '../../services/request';
import { useToast } from '../../contexts/ToastContext';

const VCenterConfig: React.FC = () => {
  const { showToast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/vcenter-details/config');
      if (res.data) {
        setAutoRefresh(!!res.data.autoRefresh);
        if (res.data.updatedAt) {
          setUpdatedAt(new Date(res.data.updatedAt).toLocaleString());
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Failed to load vCenter configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await request.put('/api/vcenter-details/config', {
        autoRefresh: autoRefresh,
        refreshIntervalSeconds: 30
      });
      showToast(
        `vCenter Auto Refresh is now ${autoRefresh ? 'ENABLED' : 'DISABLED'}`,
        'success'
      );
      if (res.data && res.data.updatedAt) {
        setUpdatedAt(new Date(res.data.updatedAt).toLocaleString());
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleManualRefreshAll = async () => {
    setRefreshing(true);
    try {
      const res = await request.post('/api/vcenter-details/refresh-all', {}, { timeout: 30000 });
      showToast(res.data?.message || 'Manual vCenter refresh completed successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to trigger manual vCenter refresh', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth={800}>
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              {autoRefresh ? (
                <SyncIcon sx={{ color: '#10b981', fontSize: 32 }} />
              ) : (
                <SyncDisabledIcon sx={{ color: '#ef4444', fontSize: 32 }} />
              )}
              <Box>
                <Typography variant="h6" fontWeight="700">
                  vCenter Auto Refresh Settings
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Control continuous background polling and live metric collection for vCenter appliances
                </Typography>
              </Box>
            </Box>
            <Chip
              label={autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
              color={autoRefresh ? 'success' : 'error'}
              variant="outlined"
              sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box mb={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle1" fontWeight="600">
                    Enable Background vCenter Auto Refresh
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    When enabled, the backend periodically polls registered vCenter REST APIs in background intervals (30s).
                    When disabled, vCenter APIs will only be queried on demand when you click <strong>Manual Refresh</strong>.
                  </Typography>
                </Box>
              }
            />
          </Box>

          {!autoRefresh && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Continuous API polling is currently <strong>DISABLED</strong>. To view updated metrics or VM states, use the <strong>Manual Refresh</strong> option on the vCenter page.
            </Alert>
          )}

          {updatedAt && (
            <Typography variant="caption" color="textSecondary" display="block" mb={3}>
              Last Configuration Update: {updatedAt}
            </Typography>
          )}

          <Box display="flex" gap={2} mt={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 600 }}
            >
              Save Configuration
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              onClick={handleManualRefreshAll}
              disabled={refreshing}
              sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 600 }}
            >
              Manual Refresh All vCenters Now
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VCenterConfig;
