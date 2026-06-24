import request from '../../services/request';

export const fetchMonitoredServers = async (params: { skip?: number; limit?: number; search?: string; status?: string; sortBy?: string; order?: string }) => {
  const response = await request.get('/api/server-ping-monitoring/', { params });
  return response.data;
};

export const createMonitoredServer = async (payload: { name: string; ipAddress: string; adminName?: string; monitoringType: string; interval: number; timeout: number; retryCount: number; ports: number[]; isEnabled: boolean }) => {
  const response = await request.post('/api/server-ping-monitoring/', payload);
  return response.data;
};

export const updateMonitoredServer = async (id: string, payload: { name?: string; ipAddress?: string; adminName?: string; monitoringType?: string; interval?: number; timeout?: number; retryCount?: number; ports?: number[]; isEnabled?: boolean }) => {
  const response = await request.put(`/api/server-ping-monitoring/${id}`, payload);
  return response.data;
};

export const deleteMonitoredServer = async (id: string) => {
  const response = await request.delete(`/api/server-ping-monitoring/${id}`);
  return response.data;
};

export const fetchDashboardData = async () => {
  const response = await request.get('/api/server-ping-monitoring/dashboard');
  return response.data;
};

export const fetchActiveIncidents = async () => {
  const response = await request.get('/api/server-ping-monitoring/incidents');
  return response.data;
};

export const acknowledgeIncident = async (id: string) => {
  const response = await request.post(`/api/server-ping-monitoring/incidents/${id}/acknowledge`);
  return response.data;
};

export const fetchNotificationChannels = async () => {
  const response = await request.get('/api/server-ping-monitoring/channels');
  return response.data;
};

export const updateNotificationChannel = async (id: string, payload: { isEnabled: boolean; config: any }) => {
  const response = await request.put(`/api/server-ping-monitoring/channels/${id}`, payload);
  return response.data;
};

export const fetchPingDropLogs = async (params: { skip?: number; limit?: number; start_date?: string; end_date?: string }) => {
  const response = await request.get('/api/server-ping-monitoring/logs', { params });
  return response.data;
};

export const exportPingDropLogs = async (params: { start_date?: string; end_date?: string }) => {
  const response = await request.get('/api/server-ping-monitoring/logs/export', { 
    params,
    responseType: 'blob'
  });
  return response.data;
};
