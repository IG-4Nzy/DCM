// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import request from '../../services/request';
import { useToast } from '../../contexts/ToastContext';

const VCenterConfig: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await request.get('/api/vcenter-details/config');
      if (res.data) {
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

  const handleManualRefreshAll = async () => {
    setRefreshing(true);
    try {
      const res = await request.post('/api/vcenter-details/refresh-all', {}, { timeout: 30000 });
      showToast(res.data?.message || 'Manual vCenter refresh completed successfully!', 'success');
      if (res.data && res.data.updatedAt) {
        setUpdatedAt(new Date(res.data.updatedAt).toLocaleString());
      } else {
        setUpdatedAt(new Date().toLocaleString());
      }
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
              <SyncIcon sx={{ color: '#3b82f6', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight="700">
                  vCenter Manual Sync Control
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Force immediate background telemetry sync and database aggregation for all registered vCenter appliances.
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Background automatic vCenter auto-refresh is disabled. To view updated metrics, datastores, or VM states, please trigger a sync manually.
          </Alert>

          {updatedAt && (
            <Typography variant="caption" color="textSecondary" display="block" mb={3}>
              Last Manual Sync Triggered: {updatedAt}
            </Typography>
          )}

          <Box display="flex" gap={2} mt={2}>
            <Button
              variant="contained"
              color="primary"
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
